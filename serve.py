#!/usr/bin/env python3
"""Static file server with HTTP Range support (needed for video seeking / scroll-scrub).
Python's built-in http.server ignores Range requests, which breaks <video> seeking."""
import os
import re
import http.server
import socketserver

PORT = int(os.environ.get("PORT", "5577"))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # avoid stale caching while developing
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        fs = os.fstat(f.fileno())
        size = fs[6]
        ctype = self.guess_type(path)
        rng = self.headers.get("Range")
        m = re.match(r"bytes=(\d+)-(\d*)", rng) if rng else None
        if m:
            start = int(m.group(1))
            end = int(m.group(2)) if m.group(2) else size - 1
            end = min(end, size - 1)
            if start > end or start >= size:
                f.close()
                self.send_error(416, "Requested Range Not Satisfiable")
                return None
            length = end - start + 1
            self.send_response(206)
            self.send_header("Content-type", ctype)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
            self.send_header("Content-Length", str(length))
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.end_headers()
            f.seek(start)
            self._range_remaining = length
            return f
        self.send_response(200)
        self.send_header("Content-type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(size))
        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_range_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        self._range_remaining = None
        while remaining > 0:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            try:
                outputfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                break
            remaining -= len(chunk)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    os.chdir(DIRECTORY)
    with Server(("", PORT), RangeHandler) as httpd:
        print("Serving %s on :%d (Range-enabled)" % (DIRECTORY, PORT))
        httpd.serve_forever()
