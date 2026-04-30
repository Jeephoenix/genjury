# CommunityVerdict — GenLayer Intelligent Contract
# DAO Dispute Resolution with AI-Powered Evidence Validation
# ============================================================

from genlayer import *


@gl.contract
class CommunityVerdict:
    # ── State Declaration ──────────────────────────────────────────────────
    admin: str                          
    members: TreeMap[str, bool]         
    disputes: TreeMap[int, dict]        
    dispute_count: int                  
    votes: TreeMap[str, str]            
    vote_counts: TreeMap[int, dict]     
    min_votes: int                      

    # ── Constructor ────────────────────────────────────────────────────────
    def __init__(self, min_votes_required: int = 3):
        self.admin = gl.message.sender_address
        # Explicitly typing the TreeMaps during initialization
        self.members = TreeMap[str, bool]()
        self.disputes = TreeMap[int, dict]()
        self.dispute_count = 0
        self.votes = TreeMap[str, str]()
        self.vote_counts = TreeMap[int, dict]()
        self.min_votes = min_votes_required

    # ── Admin: Manage Members ──────────────────────────────────────────────

    @gl.public.write
    def add_member(self, address: str) -> None:
        """Admin adds a DAO member."""
        assert gl.message.sender_address == self.admin, "Only admin can add members"
        # Using .get() to avoid KeyErrors during membership checks
        is_already_member = self.members.get(address, False)
        assert not is_already_member, "Already a member"
        self.members[address] = True

    @gl.public.write
    def remove_member(self, address: str) -> None:
        """Admin removes a DAO member."""
        assert gl.message.sender_address == self.admin, "Only admin can remove members"
        self.members[address] = False

    # ── Core: Submit Dispute ───────────────────────────────────────────────

    @gl.public.write
    def submit_dispute(
        self,
        respondent: str,
        description: str,
        evidence_url: str,
    ) -> int:
        claimant = gl.message.sender_address

        # Validation checks
        assert self.members.get(claimant, False), "You must be a DAO member to file a dispute"
        assert self.members.get(respondent, False), "Respondent must be a DAO member"
        assert claimant != respondent, "Cannot dispute yourself"
        assert len(description) >= 20, "Description too short"
        assert evidence_url.startswith("http"), "Evidence URL must be valid"

        # ── AI Web Validation ──────────────────────────────────────────────
        # Fetching content via GenLayer's internet access
        evidence_page = gl.get_webpage(evidence_url, mode="text")

        # Consensus-driven AI summary
        evidence_summary = gl.eq_principle_prompt_comparative(
            evidence_page,
            task=(
                "Extract a neutral factual summary (max 300 words) of the evidence. "
                "Be objective. If unreachable, return: 'Evidence inaccessible.'"
            ),
            principle=(
                "Summaries are equivalent if they capture the same key facts and actors."
            ),
        )

        # ── Store Dispute ──────────────────────────────────────────────────
        dispute_id = self.dispute_count

        self.disputes[dispute_id] = {
            "id": dispute_id,
            "claimant": claimant,
            "respondent": respondent,
            "description": description,
            "evidence_url": evidence_url,
            "evidence_summary": evidence_summary,
            "status": "open",
            "verdict": None,
            "created_at": gl.message.block_timestamp,
            "resolved_at": None,
        }

        self.vote_counts[dispute_id] = {"guilty": 0, "not_guilty": 0}
        self.dispute_count += 1

        return dispute_id

    # ── Core: Vote ─────────────────────────────────────────────────────────

    @gl.public.write
    def cast_vote(self, dispute_id: int, vote: str) -> None:
        voter = gl.message.sender_address

        assert self.members.get(voter, False), "Only DAO members can vote"
        assert vote in ("guilty", "not_guilty"), "Invalid vote type"
        
        dispute = self.disputes.get(dispute_id)
        assert dispute is not None, "Dispute does not exist"
        assert dispute["status"] == "open", "Dispute is already resolved"
        assert voter != dispute["claimant"], "Claimant cannot vote"
        assert voter != dispute["respondent"], "Respondent cannot vote"

        vote_key = f"{dispute_id}:{voter}"
        assert self.votes.get(vote_key) is None, "Already voted"

        # Record the vote
        self.votes[vote_key] = vote
        counts = self.vote_counts[dispute_id]
        counts[vote] += 1
        self.vote_counts[dispute_id] = counts

    # ── Core: Resolve ──────────────────────────────────────────────────────

    @gl.public.write
    def resolve_dispute(self, dispute_id: int) -> str:
        dispute = self.disputes.get(dispute_id)
        assert dispute is not None, "Dispute does not exist"
        assert dispute["status"] == "open", "Dispute is already resolved"

        counts = self.vote_counts[dispute_id]
        total_votes = counts["guilty"] + counts["not_guilty"]

        assert total_votes >= self.min_votes, f"Need {self.min_votes} votes"

        if counts["guilty"] > counts["not_guilty"]:
            verdict = "guilty"
        elif counts["not_guilty"] > counts["guilty"]:
            verdict = "not_guilty"
        else:
            verdict = "tie"

        # Update and save
        dispute["status"] = "resolved"
        dispute["verdict"] = verdict
        dispute["resolved_at"] = gl.message.block_timestamp
        self.disputes[dispute_id] = dispute

        return verdict

    # ── Read: Getters ──────────────────────────────────────────────────────

    @gl.public.read
    def get_dispute(self, dispute_id: int) -> dict:
        d = self.disputes.get(dispute_id)
        assert d is not None, "Dispute not found"
        return d

    @gl.public.read
    def get_all_disputes(self) -> list:
        result = []
        for i in range(self.dispute_count):
            result.append(self.disputes[i])
        return result

    @gl.public.read
    def is_member(self, address: str) -> bool:
        return self.members.get(address, False)
