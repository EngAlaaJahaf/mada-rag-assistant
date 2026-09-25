"""Regression tests use fake processes; never start the model or HTTP server."""
import io
import os
import unittest
from unittest.mock import Mock, patch, mock_open

import server


class StartupTests(unittest.TestCase):
    def test_relative_paths_are_anchored_to_app_not_child_cwd(self):
        config = {'spec': 'low', 'exe': r'portable\llama\llama-server.exe',
                  'model': r'portable\models\model.gguf'}
        with patch.object(server, 'load_model_config', return_value=config), \
                patch.object(server.os.path, 'isfile', return_value=True):
            result = server.get_llm_config()
        self.assertEqual(result['model'], os.path.join(server.ROOT, config['model']))
        self.assertTrue(os.path.isabs(result['exe']))
        self.assertEqual((result['port'], result['ctx'], result['ngl']), (8081, 4096, 0))

    def test_only_one_process_is_started_while_loading(self):
        proc = Mock()
        proc.poll.return_value = None
        config = {'exe': r'D:\app\portable\llama\llama-server.exe',
                  'model': r'D:\app\portable\models\model.gguf',
                  'ctx': 1024, 'ngl': 0, 'threads': 2}
        with patch.object(server, '_llm_proc', None), patch.object(server, '_procs', []), \
                patch.object(server, '_llm_alive', return_value=False), \
                patch.object(server, 'generation_available', return_value=True), \
                patch.object(server, 'get_llm_config', return_value=config), \
                patch('builtins.open', mock_open()), \
                patch.object(server.subprocess, 'Popen', return_value=proc) as popen:
            self.assertTrue(server.ensure_llm())
            self.assertTrue(server.ensure_llm())
            popen.assert_called_once()
            argv = popen.call_args.args[0]
            self.assertEqual(argv[argv.index('-m') + 1], config['model'])
            self.assertEqual(argv[argv.index('--port') + 1], '8081')

    def test_process_exit_fails_fast_and_includes_log(self):
        proc = Mock(returncode=7)
        proc.poll.return_value = 7
        with patch.object(server, '_llm_proc', proc), \
                patch.object(server, 'ensure_llm', return_value=True), \
                patch.object(server, '_llm_alive', return_value=False), \
                patch.object(server.time, 'sleep') as sleep:
            self.assertFalse(server._ensure_llm_ready())
            sleep.assert_not_called()
        with patch('builtins.open', return_value=io.BytesIO(b'failed to load model')):
            message = server.llm_failure_message()
        self.assertIn('exit=7', message)
        self.assertIn('failed to load model', message)

    def test_saved_local_endpoints_use_automatic_startup(self):
        for endpoint in (None, 'http://127.0.0.1:8080/v1', 'http://localhost:8081/v1'):
            with self.subTest(endpoint=endpoint), \
                    patch.object(server, '_ensure_llm_ready', return_value=False) as ready, \
                    patch.object(server, 'llm_failure_message', return_value='startup diagnostic'):
                with self.assertRaisesRegex(RuntimeError, 'startup diagnostic'):
                    list(server.stream_llm([], endpoint=endpoint))
                ready.assert_called_once()

    def test_disconnected_client_does_not_raise(self):
        handler = Mock()
        handler.wfile.write.side_effect = ConnectionAbortedError(10053, 'aborted')
        server.Handler._send(handler, 500, 'application/json', b'{}')
        self.assertTrue(handler.close_connection)


if __name__ == '__main__':
    unittest.main()
