"""Automated guard for the P1 B1 architectural invariant:

    No vendor SDK import may exist outside src/providers/.

B1 routed all three production AI call sites (evaluation, OCR, blueprint)
through providers/openai_adapter.py so that swapping or adding a provider is a
change in one package rather than three. Nothing mechanically prevented that
from regressing, so this test is the enforcement — it runs in CI via the
existing `pytest -q` step in .github/workflows/ci.yml.

Deliberately narrow (27-AI-EVALUATION-ARCHITECTURE.md §8a, not a general
dependency policy): it names the two vendor SDKs B1 actually removed and the one
package allowed to import them. Adding a second provider means adding its SDK to
FORBIDDEN_ROOTS, not rewriting this file.

Inspects real `ast.Import` / `ast.ImportFrom` nodes rather than grepping text —
during B1 a grep-based sweep produced a false positive by matching the word
"openai" inside a docstring, which is exactly the failure mode that erodes trust
in a guard. Because it reads import nodes, it also catches imports nested inside
functions or `if TYPE_CHECKING` blocks, which a top-of-file check would miss.

Known limitation, stated rather than papered over: a dynamic
`importlib.import_module("openai")` is invisible to this check. Closing that
would require import-time interception, which is disproportionate to the risk of
someone reaching for a vendor SDK by accident.
"""

import ast
from pathlib import Path

import pytest

# Root package names of vendor model SDKs. Matches `import openai`,
# `import openai.foo`, `from openai import X` and `from openai.bar import Y`.
FORBIDDEN_ROOTS = {"openai", "langchain_openai"}

# The one package permitted to reach a vendor SDK directly.
ALLOWED_PACKAGE = "providers"

SRC = Path(__file__).resolve().parent.parent / "src"


def vendor_imports(source: str, label: str) -> list[str]:
    """Every vendor-SDK import in `source`, as human-readable "label:line stmt"
    strings. Shared by the production sweep and the self-test below so the guard
    is verified with the same code path it enforces with."""
    found = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.split(".")[0] in FORBIDDEN_ROOTS:
                    found.append(f"{label}:{node.lineno} import {alias.name}")
        elif isinstance(node, ast.ImportFrom):
            # `node.module` is None for relative imports (`from . import x`),
            # which can never name a third-party root package.
            if node.module and node.module.split(".")[0] in FORBIDDEN_ROOTS:
                found.append(f"{label}:{node.lineno} from {node.module} import ...")
    return found


def test_no_vendor_sdk_imports_outside_the_providers_package():
    violations = []
    for path in sorted(SRC.rglob("*.py")):
        if ALLOWED_PACKAGE in path.relative_to(SRC).parts:
            continue
        violations.extend(
            vendor_imports(path.read_text(encoding="utf-8"), str(path.relative_to(SRC.parent)))
        )

    assert not violations, (
        "Vendor SDK imported outside src/"
        + ALLOWED_PACKAGE
        + "/:\n  "
        + "\n  ".join(violations)
        + "\n\nRoute the call through src/providers/openai_adapter.py instead "
        "(GenerateRequest -> adapter.generate() -> parse), so provider details "
        "stay in one package. See 27-AI-EVALUATION-ARCHITECTURE.md §8a."
    )


def test_the_providers_package_does_import_a_vendor_sdk():
    """Guards against the guard passing vacuously. If the adapter ever stopped
    importing a vendor SDK, the sweep above would still pass while proving
    nothing — this pins that there is a real import for it to be excluding."""
    found = []
    for path in sorted((SRC / ALLOWED_PACKAGE).rglob("*.py")):
        found.extend(vendor_imports(path.read_text(encoding="utf-8"), path.name))

    assert found, "src/providers/ imports no vendor SDK — the exclusion above is now meaningless"


@pytest.mark.parametrize(
    "source",
    [
        "import openai",
        "import openai.types",
        "from openai import AsyncOpenAI",
        "from langchain_openai import ChatOpenAI",
        "from openai.types.chat import ChatCompletion",
        "def f():\n    import openai\n    return openai",  # nested in a function
        "from typing import TYPE_CHECKING\nif TYPE_CHECKING:\n    import openai",
    ],
    ids=[
        "plain-import",
        "submodule-import",
        "from-import",
        "langchain-openai",
        "deep-from-import",
        "function-scoped",
        "type-checking-block",
    ],
)
def test_the_guard_actually_detects_each_violation_form(source):
    """A guard nobody has seen fail is not known to work. These are the forms a
    future regression would plausibly take."""
    assert vendor_imports(source, "synthetic.py"), f"guard missed a violation: {source!r}"


@pytest.mark.parametrize(
    "source",
    [
        "from src.providers.openai_adapter import OpenAIAdapter",
        "from langchain_core.output_parsers import PydanticOutputParser",
        "import json",
        "from . import types",
        '"""A docstring mentioning openai and langchain_openai."""',
        'MODEL = "openai/gpt-4o"',
    ],
    ids=[
        "adapter-import",
        "langchain-core-not-a-vendor-sdk",
        "stdlib",
        "relative-import",
        "docstring-mention",
        "string-literal",
    ],
)
def test_the_guard_does_not_flag_legitimate_code(source):
    """The docstring and string-literal cases are the exact false positive a
    grep-based sweep produced during B1, and the reason this is AST-based.
    langchain_core is the prompting/parsing layer, not a vendor model SDK — all
    three call sites still use it by design."""
    assert not vendor_imports(source, "synthetic.py"), f"guard false-positived on: {source!r}"
