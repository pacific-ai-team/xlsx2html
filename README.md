[![PyPi](https://img.shields.io/pypi/v/xlsx2html.svg)](https://pypi.python.org/pypi/xlsx2html)
[![Build Status](https://travis-ci.org/Apkawa/xlsx2html.svg?branch=master)](https://travis-ci.org/Apkawa/xlsx2html)
[![Codecov](https://codecov.io/gh/Apkawa/xlsx2html/branch/master/graph/badge.svg)](https://codecov.io/gh/Apkawa/xlsx2html)
[![Requirements Status](https://requires.io/github/Apkawa/xlsx2html/requirements.svg?branch=master)](https://requires.io/github/Apkawa/xlsx2html/requirements/?branch=master)
[![PyUP](https://pyup.io/repos/github/Apkawa/xlsx2html/shield.svg)](https://pyup.io/repos/github/Apkawa/xlsx2html)
[![Python versions](https://img.shields.io/pypi/pyversions/xlsx2html.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

# xlsx2html

A simple export from xlsx format to html tables with keep cell formatting


# Install

```bash
pip install xlsx2html
```


# Usage
Simple usage
```python
from xlsx2html import xlsx2html

out_stream = xlsx2html('path/to/example.xlsx')
out_stream.seek(0)
print(out_stream.read())

```

or pass filepath
```python
from xlsx2html import xlsx2html

xlsx2html('path/to/example.xlsx', 'path/to/output.html')
```
or use file like objects

```python
import io
from xlsx2html import xlsx2html

# must be binary mode
xlsx_file = open('path/to/example.xlsx', 'rb')
out_file = io.StringIO()
xlsx2html(xlsx_file, out_file, locale='en')
out_file.seek(0)
result_html = out_file.read()
```

or from shell

```bash
python -m xlsx2html path/to/example.xlsx path/to/output.html
```

# Pacific

Increment the version in setup.py
make build-wheel
Copy the wheel directly to the repo you need to use it in

## CI test recovery

The Python compatibility matrix, headless Chrome checks, coverage and Bulgarian
CP1251 repeat remain required. Each matrix entry runs only its selected Python
interpreter. The vendored `ci_runtime` records setup/call/teardown timings and
checkpoints complete passing files together with their coverage. A retry of the
same GitHub workflow run restores that matrix entry's completed files; changed
revision, interpreter, invocation or collection invalidates reuse. The two
locales have separate timing plans and checkpoints.

Timing history is frozen once per workflow run and matrix entry. Keep the
current single-worker budget until an actual multi-worker comparison shows
both lower elapsed time and lower total compute, including browser startup.
The deterministic measured packer can then distribute work across the selected
worker count; never independently rebuild history during a retry.

Production runtime files are owned by `pacific-deploy/ci_runtime`; update with
`python3 infra/scripts/sync_ci_runtime.py --root .. --repo xlsx2html` from that
repository, rather than editing a vendored copy.
