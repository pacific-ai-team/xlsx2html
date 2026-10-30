import os
import tempfile

import pytest

FIXTURES_ROOT = os.path.join(os.path.dirname(__file__), "fixtures")
IN_GITHUB_ACTIONS = os.getenv("GITHUB_ACTIONS") == "true"


@pytest.fixture()
def fixture_file():
    return lambda name: os.path.join(FIXTURES_ROOT, name)


@pytest.fixture(scope="session")
def image_diff_reference_dir():
    return os.path.join(os.path.dirname(__file__), "screenshots")


@pytest.fixture(scope="session")
def image_diff_threshold():
    return 0.05


@pytest.fixture(scope="session")
def image_diff_color_mode():
    """
    Normalize color mode. RGB, RGBA, None. Default None - do nothing
    """
    return "RGB"


@pytest.fixture(scope="function")
def temp_file():
    temp_files = []

    def tempfile_factory(extension=".html", prefix="xlsx2html_"):
        tf = tempfile.mktemp(suffix=extension, prefix="xlsx2html_")
        temp_files.append(tf)
        return tf

    yield tempfile_factory

    for tf in temp_files:
        if os.path.exists(tf):
            os.unlink(tf)


@pytest.fixture(scope="session")
def splinter_window_size():
    return (1280, 1024)


@pytest.fixture(scope="session")
def splinter_headless(request, splinter_webdriver):
    """Flag to start the browser in headless mode."""
    # Splinter 0.21 treats this as a bool and discards the "old" mode string.
    # Chrome's pinned mode is configured explicitly in its options below.
    return request.config.option.splinter_headless and splinter_webdriver != "chrome"


@pytest.fixture(scope="session")
def splinter_webdriver(request):
    return request.config.option.splinter_webdriver or "chrome"


@pytest.fixture(scope="session")
def splinter_driver_kwargs(request, splinter_webdriver, splinter_window_size):
    kw = {}
    # TODO check for another browsers https://github.com/cobrateam/splinter/pull/1132/
    if splinter_webdriver == "chrome":
        executable = request.config.option.splinter_webdriver_executable
        if not executable:
            from chromedriver_binary import chromedriver_filename

            executable = chromedriver_filename
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.chrome.options import Options as ChromeOptions

        options = ChromeOptions()
        if request.config.option.splinter_headless:
            options.add_argument("--headless=old")
            options.add_argument("--disable-gpu")
        options.add_argument(f"--window-size={'x'.join(map(str,splinter_window_size))}")
        options.add_argument(f"--force-device-scale-factor=1")
        kw["options"] = options
        kw["service"] = Service(
            executable_path=executable,
        )
    return kw


@pytest.fixture(scope="session")
def splinter_webdriver_executable(request, splinter_webdriver):
    """Webdriver executable directory."""
    executable = request.config.option.splinter_webdriver_executable
    if splinter_webdriver == "chrome":
        # Workaround for never chromedriver
        return None
    return os.path.abspath(executable) if executable else None


def pytest_addoption(parser):
    parser.addoption(
        "--skip-webtest",
        action="store_true",
        dest="skip_webtest",
        default=False,
        help="skip marked webtest tests",
    )


def pytest_configure(config):
    mark_expr = []

    if config.option.markexpr:
        mark_expr.append(config.option.markexpr)

    if config.option.skip_webtest:
        mark_expr.append("not webtest")
    if mark_expr:
        setattr(config.option, "markexpr", " and ".join(mark_expr))
