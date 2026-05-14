import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

EXPECTED_SENSOR_TYPES = {"BODY_ANGLE", "GROUND_CONTACT", "OSCILLATOR"}


@pytest.fixture(scope="module")
def genomes() -> list[dict]:
    response = client.get("/api/genesis")
    assert response.status_code == 200
    return response.json()


# ---------------------------------------------------------------------------
# Population-level tests
# ---------------------------------------------------------------------------


def test_genesis_returns_20_genomes(genomes):
    assert len(genomes) == 20


def test_genesis_genome_ids_are_unique(genomes):
    ids = [g["genome_id"] for g in genomes]
    assert len(set(ids)) == 20


# ---------------------------------------------------------------------------
# Per-genome field presence and top-level values
# ---------------------------------------------------------------------------

REQUIRED_FIELDS = {"genome_id", "species_id", "generation", "fitness", "node_genes", "connection_genes"}


def test_genesis_genome_has_required_fields(genomes):
    for genome in genomes:
        assert REQUIRED_FIELDS.issubset(genome.keys()), (
            f"Genome {genome.get('genome_id')} missing fields: "
            f"{REQUIRED_FIELDS - genome.keys()}"
        )


def test_genesis_generation_is_zero(genomes):
    for genome in genomes:
        assert genome["generation"] == 0, f"genome {genome['genome_id']}: generation={genome['generation']}"


def test_genesis_fitness_is_zero(genomes):
    for genome in genomes:
        assert genome["fitness"] == 0.0, f"genome {genome['genome_id']}: fitness={genome['fitness']}"


def test_genesis_no_connections(genomes):
    for genome in genomes:
        assert genome["connection_genes"] == [], (
            f"genome {genome['genome_id']} has unexpected connections"
        )


# ---------------------------------------------------------------------------
# Node structure tests
# ---------------------------------------------------------------------------


def test_genesis_has_one_body_segment(genomes):
    for genome in genomes:
        body_segments = [n for n in genome["node_genes"] if n["type"] == "BODY_SEGMENT"]
        assert len(body_segments) == 1, (
            f"genome {genome['genome_id']}: expected 1 BODY_SEGMENT, got {len(body_segments)}"
        )


def test_genesis_has_three_sensors(genomes):
    for genome in genomes:
        input_nodes = [n for n in genome["node_genes"] if n["type"] == "INPUT"]
        assert len(input_nodes) == 3, (
            f"genome {genome['genome_id']}: expected 3 INPUT nodes, got {len(input_nodes)}"
        )
        sensor_types = {n["sensor_type"] for n in input_nodes}
        assert sensor_types == EXPECTED_SENSOR_TYPES, (
            f"genome {genome['genome_id']}: sensor_types={sensor_types}"
        )


# ---------------------------------------------------------------------------
# Torso morphology range tests
# ---------------------------------------------------------------------------


def _torso(genome: dict) -> dict:
    segments = [n for n in genome["node_genes"] if n["type"] == "BODY_SEGMENT"]
    assert segments, f"genome {genome['genome_id']} has no BODY_SEGMENT"
    return segments[0]


def test_genesis_torso_width_in_range(genomes):
    for genome in genomes:
        width = _torso(genome)["width"]
        assert 10.0 <= width <= 60.0, f"genome {genome['genome_id']}: width={width}"


def test_genesis_torso_height_in_range(genomes):
    for genome in genomes:
        height = _torso(genome)["height"]
        assert 5.0 <= height <= 30.0, f"genome {genome['genome_id']}: height={height}"


def test_genesis_torso_density_in_range(genomes):
    for genome in genomes:
        density = _torso(genome)["density"]
        assert 0.5 <= density <= 3.0, f"genome {genome['genome_id']}: density={density}"


def test_genesis_torso_friction_in_range(genomes):
    for genome in genomes:
        friction = _torso(genome)["friction"]
        assert 0.1 <= friction <= 1.0, f"genome {genome['genome_id']}: friction={friction}"
