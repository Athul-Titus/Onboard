import pytest
from backend.app.tools.retrieval import retriever
from backend.app.agents.guide_manager import guide_manager
from backend.app.schemas import Guide, GuideSection, GuideItem, Citation

def test_retrieval_clean_ingestion():
    retriever.reindex()
    assert len(retriever.chunks) > 0
    for chunk in retriever.chunks:
        # Check that Sample Data disclaimer lines are stripped
        assert "sample data" not in chunk.content.lower()
        assert "synthetic sample documentation" not in chunk.content.lower()
        # Check that raw markdown blockquotes and bold markers are stripped
        assert not chunk.content.startswith(">")
        assert "**" not in chunk.content
        # Check that title-only/intro chunks with minimal content are dropped
        assert len(chunk.content.strip()) >= 30
        assert chunk.content.strip().lower() != chunk.section.lower()

def test_first_complete_sentence_no_mid_sentence_truncation():
    # Long text with full sentence
    text = "Clone the repository and install all dependencies. Then run the development server."
    res = guide_manager._first_complete_sentence(text, max_chars=60)
    assert res == "Clone the repository and install all dependencies."
    assert not res.endswith("..")

    # Single sentence exceeding max_chars cuts cleanly at word boundary
    long_single = "Configure your Kubernetes production deployment manifest with the updated secret references and helm values"
    res2 = guide_manager._first_complete_sentence(long_single, max_chars=50)
    assert not res2.endswith("references and")
    assert res2.endswith(".")

def test_deduplicate_sections_and_repeated_not_documented():
    sections = [
        GuideSection(
            title="Section 1",
            items=[
                GuideItem(text="Install Docker Desktop.", status="grounded"),
                GuideItem(text="Not documented — ask your lead.", status="not_documented"),
            ]
        ),
        GuideSection(
            title="Section 2",
            items=[
                GuideItem(text="Install Docker Desktop.", status="grounded"),  # duplicate across sections
                GuideItem(text="Not documented — ask your lead.", status="not_documented"),  # duplicate not_documented
                GuideItem(text="Request 1Password access.", status="grounded"),
            ]
        )
    ]
    deduped = guide_manager._deduplicate_sections(sections)
    # Section 1 retains its items
    assert len(deduped[0].items) == 2
    # Section 2 should have dropped the duplicate text and the duplicate "Not documented"
    sec2_texts = [item.text for item in deduped[1].items]
    assert "Install Docker Desktop." not in sec2_texts
    assert "Not documented — ask your lead." not in sec2_texts
    assert "Request 1Password access." in sec2_texts

def test_unsupported_guide_line_dropped():
    # Create guide with 1 valid grounded item and 1 hallucinated/unsupported citation
    valid_item = GuideItem(
        text="Install Python 3.11 and Docker Desktop.",
        citation=Citation(doc="02_dev_env_setup_backend.md", section="Prerequisites"),
        status="grounded"
    )
    fake_item = GuideItem(
        text="Configure quantum teleportation submodules.",
        citation=Citation(doc="nonexistent_fake_doc.md", section="Quantum Setup"),
        status="grounded"
    )
    guide = Guide(
        employee_id="test-emp",
        sections=[
            GuideSection(title="Day 1", items=[valid_item, fake_item])
        ]
    )

    verified_guide, verified_count, total_count = guide_manager._verifier_pass(guide, drop_unsupported=True)

    assert total_count == 2
    assert verified_count == 1
    # Check that the unsupported fake_item was dropped from the section!
    items = verified_guide.sections[0].items
    assert len(items) == 1
    assert items[0].text == "Install Python 3.11 and Docker Desktop."
