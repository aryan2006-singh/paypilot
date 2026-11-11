import pytest

from evals.run_evals import evaluate, load_cases


@pytest.mark.parametrize("case", load_cases(), ids=lambda c: c["message"][:40])
def test_router_eval_case(case):
    ok, got = evaluate(case)
    assert ok, got
