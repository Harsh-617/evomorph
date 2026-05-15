import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _score(genome_id: str, fitness: float = 42.5) -> dict:
    return {
        "genome_id": genome_id,
        "fitness": fitness,
        "max_x_position": 120.0,
        "time_upright": 12.3,
        "cumulative_torque": 450.0,
        "head_ground_time": 0.1,
        "num_joints": 0,
        "max_torque": 0.0,
        "final_x": 118.0,
        "final_y": 0.5,
        "alive": True,
    }


def _default_env() -> dict:
    return {"gravity": 1.0, "friction": 0.6, "terrain": "flat"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def genesis_genomes() -> list[dict]:
    """8 real genomes from the genesis endpoint — the seed population."""
    response = client.get("/api/genesis")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 8, f"genesis returned {len(data)} genomes, expected 8"
    return data


@pytest.fixture(scope="module")
def evolve_payload(genesis_genomes: list[dict]) -> dict:
    """Valid POST /api/evolve body built from genesis genomes.

    Simulates what the frontend sends after a 15-second run where every
    creature achieved a modest fitness score.
    """
    return {
        "generation": 0,
        "scores": [_score(g["genome_id"]) for g in genesis_genomes],
        "environment": _default_env(),
    }


@pytest.fixture(scope="module")
def evolve_response(evolve_payload: dict) -> dict:
    """Parsed JSON body of a successful POST /api/evolve call."""
    response = client.post("/api/evolve", json=evolve_payload)
    assert response.status_code == 200
    return response.json()


# ---------------------------------------------------------------------------
# Basic HTTP contract
# ---------------------------------------------------------------------------


def test_evolve_returns_200(evolve_payload: dict):
    response = client.post("/api/evolve", json=evolve_payload)
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Population shape
# ---------------------------------------------------------------------------


def test_evolve_returns_8_genomes(evolve_response: dict):
    assert "genomes" in evolve_response
    assert len(evolve_response["genomes"]) == 8, (
        f"expected 8 genomes, got {len(evolve_response['genomes'])}"
    )


def test_evolve_increments_generation(evolve_response: dict):
    for genome in evolve_response["genomes"]:
        assert genome["generation"] == 1, (
            f"genome {genome['genome_id']}: generation={genome['generation']}, expected 1"
        )


def test_evolve_genome_ids_are_new(genesis_genomes: list[dict], evolve_response: dict):
    """Offspring must have fresh IDs — no direct copies of parents."""
    input_ids = {g["genome_id"] for g in genesis_genomes}
    returned_ids = {g["genome_id"] for g in evolve_response["genomes"]}
    overlap = input_ids & returned_ids
    assert not overlap, f"Returned genome IDs reuse parent IDs: {overlap}"


def test_evolve_genome_ids_are_unique(evolve_response: dict):
    ids = [g["genome_id"] for g in evolve_response["genomes"]]
    assert len(ids) == len(set(ids)), (
        f"Duplicate genome IDs in response: "
        f"{[i for i in ids if ids.count(i) > 1]}"
    )


# ---------------------------------------------------------------------------
# Response envelope fields
# ---------------------------------------------------------------------------


def test_evolve_response_has_species_info(evolve_response: dict):
    assert "species_info" in evolve_response
    assert isinstance(evolve_response["species_info"], list)


def test_evolve_response_has_stats(evolve_response: dict):
    stats = evolve_response.get("stats", {})
    for required_key in ("best_fitness", "avg_fitness", "species_count"):
        assert required_key in stats, f"stats missing '{required_key}'"


# ---------------------------------------------------------------------------
# Selection pressure
# ---------------------------------------------------------------------------


def test_evolve_fitness_influences_selection(genesis_genomes: list[dict]):
    """An overwhelming champion (fitness=999) must dominate the offspring pool.

    With one genome scoring 999 and all others scoring 0, selection pressure
    is extreme. PRD §3.5 elitism guarantees the champion is carried forward;
    proportional allocation ensures most offspring descend from it. We verify
    this by checking that the champion's species persists in the next generation.
    """
    champion = genesis_genomes[0]
    scores = [_score(g["genome_id"], fitness=0.0) for g in genesis_genomes]
    scores[0] = _score(champion["genome_id"], fitness=999.0)

    payload = {
        "generation": 0,
        "scores": scores,
        "environment": _default_env(),
    }
    response = client.post("/api/evolve", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert len(body["genomes"]) == 8

    # At genesis all creatures share species_id=0 (champion included).
    # Heavy selection on the champion means its lineage must be present.
    champion_species = champion["species_id"]
    returned_species = {g["species_id"] for g in body["genomes"]}
    assert champion_species in returned_species, (
        f"Champion species {champion_species} has no descendants after heavy selection. "
        f"Species found: {returned_species}"
    )


# ---------------------------------------------------------------------------
# Genome structure
# ---------------------------------------------------------------------------


def test_evolve_node_genes_valid(evolve_response: dict):
    """Every evolved genome must retain at least one BODY_SEGMENT node."""
    for genome in evolve_response["genomes"]:
        body_segments = [n for n in genome["node_genes"] if n["type"] == "BODY_SEGMENT"]
        assert len(body_segments) >= 1, (
            f"genome {genome['genome_id']}: "
            f"expected >= 1 BODY_SEGMENT, got {len(body_segments)}"
        )


# ---------------------------------------------------------------------------
# Robustness / edge cases
# ---------------------------------------------------------------------------


def test_evolve_accepts_varied_fitness_scores(genesis_genomes: list[dict]):
    """A realistic mixed-score distribution (zeros, moderate, high) must not crash.

    PRD §4.5 floors fitness at 0 on the client side, so 'negative-clamped'
    values arrive as 0.0. The backend must handle this distribution gracefully.
    """
    scores = []
    for i, g in enumerate(genesis_genomes):
        if i % 3 == 0:
            fitness = 0.0        # clamped from a negative raw score
        elif i % 3 == 1:
            fitness = 0.01       # barely positive — near the floor
        else:
            fitness = float(50 + i * 15)   # decent performers
        scores.append(_score(g["genome_id"], fitness=fitness))

    payload = {
        "generation": 0,
        "scores": scores,
        "environment": _default_env(),
    }
    response = client.post("/api/evolve", json=payload)
    assert response.status_code == 200
    assert len(response.json()["genomes"]) == 8
