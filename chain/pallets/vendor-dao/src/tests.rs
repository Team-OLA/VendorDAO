use crate::{
	mock::*, DocumentType, DonorType, Donors, Error, Event, GrantCount, Grants, KycRecords, KycStatus,
	ProposalCount, ProposalStatus, Proposals, RfpCount, RfpStatus, Rfps, SpendingReceiptCount, SpendingReceipts,
	VendorCategory, VendorUpdateCount, VendorUpdates, Vendors, Ward,
};
use frame_support::{assert_noop, assert_ok, traits::fungible::Inspect};

const VENDOR: u64 = 10;
const CITIZEN_1: u64 = 1;
const CITIZEN_2: u64 = 2;
const CITIZEN_3: u64 = 3;
const CITIZEN_4: u64 = 4;

fn run_to_block(n: u64) {
	while System::block_number() < n {
		System::set_block_number(System::block_number() + 1);
	}
}

fn register_vendor(who: u64) {
	assert_ok!(VendorDao::register_vendor(
		RuntimeOrigin::signed(who),
		b"Acme Paving Co".to_vec().try_into().unwrap(),
		VendorCategory::Construction,
		b"Paving and road maintenance contractor.".to_vec().try_into().unwrap(),
		b"contact@acmepaving.example".to_vec().try_into().unwrap(),
		b"123 Main St, Detroit, MI".to_vec().try_into().unwrap(),
		b"https://acmepaving.example".to_vec().try_into().unwrap(),
	));
}

fn submit_test_proposal(proposer: u64, vendor: u64, amount: u128) -> u32 {
	let id = ProposalCount::<Test>::get();
	assert_ok!(VendorDao::submit_proposal(
		RuntimeOrigin::signed(proposer),
		vendor,
		b"Repave Main St".to_vec().try_into().unwrap(),
		b"Repaving 3 blocks of Main Street".to_vec().try_into().unwrap(),
		amount,
		Ward::Citywide,
		None,
	));
	// Most tests exercise the voting lifecycle, not vetting itself, so auto-vet by default.
	assert_ok!(VendorDao::vet_proposal(RuntimeOrigin::root(), id, true));
	id
}

/// Funds the treasury, votes a proposal to a passing majority, and closes it -- landing on
/// `Funded` (assuming the treasury received at least `amount`).
fn fund_and_approve(id: u32, amount: u128) {
	assert_ok!(VendorDao::fund_treasury(RuntimeOrigin::signed(CITIZEN_1), amount));
	assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_1), id, true));
	assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_2), id, true));
	assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_3), id, true));
	run_to_block(VotingPeriod::get() + 2);
	assert_ok!(VendorDao::close_proposal(RuntimeOrigin::signed(CITIZEN_4), id));
}

#[test]
fn register_vendor_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		assert!(Vendors::<Test>::get(VENDOR).is_some());
		System::assert_last_event(
			Event::VendorRegistered {
				who: VENDOR,
				name: b"Acme Paving Co".to_vec().try_into().unwrap(),
				category: VendorCategory::Construction,
			}
			.into(),
		);
	});
}

#[test]
fn cannot_register_vendor_twice() {
	new_test_ext().execute_with(|| {
		register_vendor(VENDOR);
		assert_noop!(
			VendorDao::register_vendor(
				RuntimeOrigin::signed(VENDOR),
				b"Other".to_vec().try_into().unwrap(),
				VendorCategory::Other,
				b"".to_vec().try_into().unwrap(),
				b"".to_vec().try_into().unwrap(),
				b"".to_vec().try_into().unwrap(),
				b"".to_vec().try_into().unwrap(),
			),
			Error::<Test>::VendorAlreadyRegistered
		);
	});
}

#[test]
fn vendor_can_update_own_profile() {
	new_test_ext().execute_with(|| {
		register_vendor(VENDOR);
		assert_noop!(
			VendorDao::update_vendor_profile(
				RuntimeOrigin::signed(CITIZEN_1),
				VendorCategory::Housing,
				b"desc".to_vec().try_into().unwrap(),
				b"contact".to_vec().try_into().unwrap(),
				b"addr".to_vec().try_into().unwrap(),
				b"".to_vec().try_into().unwrap(),
			),
			Error::<Test>::VendorNotRegistered
		);
		assert_ok!(VendorDao::update_vendor_profile(
			RuntimeOrigin::signed(VENDOR),
			VendorCategory::Housing,
			b"Now also does affordable housing rehab.".to_vec().try_into().unwrap(),
			b"new-contact@acmepaving.example".to_vec().try_into().unwrap(),
			b"456 Side St, Detroit, MI".to_vec().try_into().unwrap(),
			b"https://acmepaving.example".to_vec().try_into().unwrap(),
		));
		let vendor = Vendors::<Test>::get(VENDOR).unwrap();
		assert_eq!(vendor.category, VendorCategory::Housing);
	});
}

#[test]
fn admin_can_verify_vendor() {
	new_test_ext().execute_with(|| {
		register_vendor(VENDOR);
		assert_noop!(
			VendorDao::set_vendor_verified(RuntimeOrigin::signed(CITIZEN_1), VENDOR, true),
			sp_runtime::DispatchError::BadOrigin
		);
		assert_ok!(VendorDao::set_vendor_verified(RuntimeOrigin::root(), VENDOR, true));
		assert!(Vendors::<Test>::get(VENDOR).unwrap().verified);
	});
}

#[test]
fn submit_proposal_requires_registered_vendor() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			VendorDao::submit_proposal(
				RuntimeOrigin::signed(CITIZEN_1),
				VENDOR,
				b"Repave Main St".to_vec().try_into().unwrap(),
				b"Repaving 3 blocks of Main Street".to_vec().try_into().unwrap(),
				1_000,
				Ward::Citywide,
				None,
			),
			Error::<Test>::VendorNotRegistered
		);
	});
}

#[test]
fn full_lifecycle_approved_proposal_is_funded() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);

		// Citizens fund the public, transparent treasury.
		assert_ok!(VendorDao::fund_treasury(RuntimeOrigin::signed(CITIZEN_1), 10_000));
		assert_eq!(VendorDao::treasury_balance(), 10_000);

		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);
		assert_eq!(ProposalCount::<Test>::get(), 1);

		assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_1), id, true));
		assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_2), id, true));
		assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_3), id, false));

		// Voting twice is rejected.
		assert_noop!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_1), id, true), Error::<Test>::AlreadyVoted);

		// Cannot close before the voting period ends.
		assert_noop!(
			VendorDao::close_proposal(RuntimeOrigin::signed(CITIZEN_1), id),
			Error::<Test>::VotingPeriodNotEnded
		);

		run_to_block(VotingPeriod::get() + 2);
		assert_ok!(VendorDao::close_proposal(RuntimeOrigin::signed(CITIZEN_4), id));

		let proposal = Proposals::<Test>::get(id).unwrap();
		assert_eq!(proposal.status, ProposalStatus::Funded);
		assert_eq!(Balances::balance(&VENDOR), 5_000);
		assert_eq!(VendorDao::treasury_balance(), 5_000);
		assert_eq!(Vendors::<Test>::get(VENDOR).unwrap().proposals_funded, 1);
	});
}

#[test]
fn proposal_rejected_without_quorum() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		assert_ok!(VendorDao::fund_treasury(RuntimeOrigin::signed(CITIZEN_1), 10_000));

		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);
		// Only one vote cast -- the quorum of 3 is not met.
		assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_1), id, true));

		run_to_block(VotingPeriod::get() + 2);
		assert_ok!(VendorDao::close_proposal(RuntimeOrigin::signed(CITIZEN_1), id));

		assert_eq!(Proposals::<Test>::get(id).unwrap().status, ProposalStatus::Rejected);
	});
}

#[test]
fn proposer_can_cancel_open_proposal() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);

		assert_noop!(VendorDao::cancel_proposal(RuntimeOrigin::signed(CITIZEN_2), id), Error::<Test>::NotProposer);
		assert_ok!(VendorDao::cancel_proposal(RuntimeOrigin::signed(CITIZEN_1), id));
		assert_eq!(Proposals::<Test>::get(id).unwrap().status, ProposalStatus::Cancelled);
	});
}

#[test]
fn disbursement_pending_when_treasury_underfunded() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		// Note: no treasury funding this time.
		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);

		assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_1), id, true));
		assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_2), id, true));
		assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_3), id, true));

		run_to_block(VotingPeriod::get() + 2);
		assert_ok!(VendorDao::close_proposal(RuntimeOrigin::signed(CITIZEN_4), id));

		// Still `Approved`, not `Funded`, because the pot has no balance yet.
		assert_eq!(Proposals::<Test>::get(id).unwrap().status, ProposalStatus::Approved);

		// Once the treasury receives enough funds, anyone can retry disbursement.
		assert_ok!(VendorDao::fund_treasury(RuntimeOrigin::signed(CITIZEN_1), 5_000));
		assert_ok!(VendorDao::disburse(RuntimeOrigin::signed(CITIZEN_2), id));
		assert_eq!(Proposals::<Test>::get(id).unwrap().status, ProposalStatus::Funded);
	});
}

#[test]
fn vendor_can_post_update() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);

		assert_ok!(VendorDao::post_vendor_update(
			RuntimeOrigin::signed(VENDOR),
			b"Repaving crews are on site; work is 40% complete.".to_vec().try_into().unwrap(),
			None,
		));

		assert_eq!(VendorUpdateCount::<Test>::get(VENDOR), 1);
		let update = VendorUpdates::<Test>::get(VENDOR, 0).unwrap();
		assert_eq!(update.vendor, VENDOR);
		assert_eq!(update.proposal_id, None);
		System::assert_last_event(Event::VendorUpdatePosted { vendor: VENDOR, id: 0, proposal_id: None }.into());
	});
}

#[test]
fn non_vendor_cannot_post_update() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			VendorDao::post_vendor_update(
				RuntimeOrigin::signed(CITIZEN_1),
				b"Not a vendor".to_vec().try_into().unwrap(),
				None,
			),
			Error::<Test>::VendorNotRegistered
		);
	});
}

#[test]
fn vendor_can_link_update_to_own_proposal() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);

		assert_ok!(VendorDao::post_vendor_update(
			RuntimeOrigin::signed(VENDOR),
			b"Materials ordered for Main St repaving.".to_vec().try_into().unwrap(),
			Some(id),
		));

		assert_eq!(VendorUpdates::<Test>::get(VENDOR, 0).unwrap().proposal_id, Some(id));
	});
}

#[test]
fn vendor_cannot_link_update_to_unowned_proposal() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		const OTHER_VENDOR: u64 = 11;
		register_vendor(OTHER_VENDOR);
		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);

		assert_noop!(
			VendorDao::post_vendor_update(
				RuntimeOrigin::signed(OTHER_VENDOR),
				b"Not my proposal".to_vec().try_into().unwrap(),
				Some(id),
			),
			Error::<Test>::NotProposalVendor
		);
	});
}

#[test]
fn register_donor_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		assert_ok!(VendorDao::register_donor(
			RuntimeOrigin::signed(CITIZEN_1),
			b"Kresge Foundation".to_vec().try_into().unwrap(),
			DonorType::Foundation,
		));
		assert!(Donors::<Test>::get(CITIZEN_1).is_some());
		System::assert_last_event(
			Event::DonorRegistered {
				who: CITIZEN_1,
				name: b"Kresge Foundation".to_vec().try_into().unwrap(),
				donor_type: DonorType::Foundation,
			}
			.into(),
		);
	});
}

#[test]
fn cannot_register_donor_twice() {
	new_test_ext().execute_with(|| {
		assert_ok!(VendorDao::register_donor(
			RuntimeOrigin::signed(CITIZEN_1),
			b"Kresge Foundation".to_vec().try_into().unwrap(),
			DonorType::Foundation,
		));
		assert_noop!(
			VendorDao::register_donor(
				RuntimeOrigin::signed(CITIZEN_1),
				b"Other".to_vec().try_into().unwrap(),
				DonorType::Individual,
			),
			Error::<Test>::DonorAlreadyRegistered
		);
	});
}

#[test]
fn unregistered_account_cannot_submit_grant() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			VendorDao::submit_grant(RuntimeOrigin::signed(CITIZEN_1), 1_000, b"General support".to_vec().try_into().unwrap()),
			Error::<Test>::DonorNotRegistered
		);
	});
}

#[test]
fn registered_donor_can_submit_grant() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		assert_ok!(VendorDao::register_donor(
			RuntimeOrigin::signed(CITIZEN_1),
			b"Kresge Foundation".to_vec().try_into().unwrap(),
			DonorType::Foundation,
		));

		assert_ok!(VendorDao::submit_grant(
			RuntimeOrigin::signed(CITIZEN_1),
			10_000,
			b"FY26 Community Investment Allocation".to_vec().try_into().unwrap(),
		));

		assert_eq!(GrantCount::<Test>::get(), 1);
		let grant = Grants::<Test>::get(0).unwrap();
		assert_eq!(grant.donor, CITIZEN_1);
		assert_eq!(grant.amount, 10_000);
		assert_eq!(VendorDao::treasury_balance(), 10_000);

		let donor = Donors::<Test>::get(CITIZEN_1).unwrap();
		assert_eq!(donor.total_contributed, 10_000);
		assert_eq!(donor.grants_made, 1);

		System::assert_last_event(Event::GrantSubmitted { id: 0, donor: CITIZEN_1, amount: 10_000 }.into());
	});
}

#[test]
fn payment_gateway_can_stake_mint() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		assert_eq!(Balances::balance(&CITIZEN_1), 1_000_000_000);
		assert_ok!(VendorDao::stake_mint(RuntimeOrigin::signed(PAYMENT_GATEWAY), CITIZEN_1, 5_000));
		assert_eq!(Balances::balance(&CITIZEN_1), 1_000_005_000);
		System::assert_last_event(Event::TokensStaked { who: CITIZEN_1, amount: 5_000 }.into());
	});
}

#[test]
fn non_payment_gateway_cannot_stake_mint() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			VendorDao::stake_mint(RuntimeOrigin::signed(CITIZEN_1), CITIZEN_1, 5_000),
			sp_runtime::DispatchError::BadOrigin
		);
	});
}

#[test]
fn new_proposal_starts_pending_review_and_cannot_be_voted_on() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);

		let id = ProposalCount::<Test>::get();
		assert_ok!(VendorDao::submit_proposal(
			RuntimeOrigin::signed(CITIZEN_1),
			VENDOR,
			b"Repave Main St".to_vec().try_into().unwrap(),
			b"Repaving 3 blocks of Main Street".to_vec().try_into().unwrap(),
			5_000,
			Ward::Citywide,
			None,
		));

		assert_eq!(Proposals::<Test>::get(id).unwrap().status, ProposalStatus::PendingReview);
		assert_noop!(
			VendorDao::vote(RuntimeOrigin::signed(CITIZEN_2), id, true),
			Error::<Test>::ProposalNotOpen
		);
	});
}

#[test]
fn admin_can_vet_proposal_to_open_voting() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		let id = ProposalCount::<Test>::get();
		assert_ok!(VendorDao::submit_proposal(
			RuntimeOrigin::signed(CITIZEN_1),
			VENDOR,
			b"Repave Main St".to_vec().try_into().unwrap(),
			b"Repaving 3 blocks of Main Street".to_vec().try_into().unwrap(),
			5_000,
			Ward::Citywide,
			None,
		));

		assert_ok!(VendorDao::vet_proposal(RuntimeOrigin::root(), id, true));

		let proposal = Proposals::<Test>::get(id).unwrap();
		assert_eq!(proposal.status, ProposalStatus::Proposed);
		assert_eq!(proposal.voting_end, System::block_number() + VotingPeriod::get());
		assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_2), id, true));
	});
}

#[test]
fn admin_can_veto_proposal() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		let id = ProposalCount::<Test>::get();
		assert_ok!(VendorDao::submit_proposal(
			RuntimeOrigin::signed(CITIZEN_1),
			VENDOR,
			b"Repave Main St".to_vec().try_into().unwrap(),
			b"Repaving 3 blocks of Main Street".to_vec().try_into().unwrap(),
			5_000,
			Ward::Citywide,
			None,
		));

		assert_ok!(VendorDao::vet_proposal(RuntimeOrigin::root(), id, false));

		assert_eq!(Proposals::<Test>::get(id).unwrap().status, ProposalStatus::Vetoed);
		assert_noop!(
			VendorDao::vote(RuntimeOrigin::signed(CITIZEN_2), id, true),
			Error::<Test>::ProposalNotOpen
		);
	});
}

#[test]
fn non_admin_cannot_vet_proposal() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);
		// submit_test_proposal already vetted it; re-vetting should now fail regardless of origin.
		assert_noop!(
			VendorDao::vet_proposal(RuntimeOrigin::signed(CITIZEN_1), id, true),
			sp_runtime::DispatchError::BadOrigin
		);
		assert_noop!(
			VendorDao::vet_proposal(RuntimeOrigin::root(), id, true),
			Error::<Test>::ProposalNotPendingReview
		);
	});
}

#[test]
fn proposer_can_cancel_pending_review_proposal() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		let id = ProposalCount::<Test>::get();
		assert_ok!(VendorDao::submit_proposal(
			RuntimeOrigin::signed(CITIZEN_1),
			VENDOR,
			b"Repave Main St".to_vec().try_into().unwrap(),
			b"Repaving 3 blocks of Main Street".to_vec().try_into().unwrap(),
			5_000,
			Ward::Citywide,
			None,
		));

		assert_ok!(VendorDao::cancel_proposal(RuntimeOrigin::signed(CITIZEN_1), id));
		assert_eq!(Proposals::<Test>::get(id).unwrap().status, ProposalStatus::Cancelled);
	});
}

#[test]
fn resident_kyc_approval_locks_in_ward() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		assert_ok!(VendorDao::submit_kyc(
			RuntimeOrigin::signed(CITIZEN_1),
			Ward::District1,
			DocumentType::Passport,
			[1u8; 32],
		));
		let pending = KycRecords::<Test>::get(CITIZEN_1).unwrap();
		assert_eq!(pending.status, KycStatus::Pending);
		assert_eq!(pending.document_type, DocumentType::Passport);
		assert_eq!(pending.document_hash, [1u8; 32]);
		assert_eq!(pending.verified_at, None);
		assert_eq!(pending.expires_at, None);

		assert_ok!(VendorDao::set_kyc_status(RuntimeOrigin::root(), CITIZEN_1, true, None));

		let verified = KycRecords::<Test>::get(CITIZEN_1).unwrap();
		assert_eq!(verified.status, KycStatus::Verified);
		assert_eq!(verified.verified_at, Some(1));
		assert_eq!(verified.expires_at, Some(1 + KycValidityPeriod::get()));
		System::assert_last_event(
			Event::KycVerified { who: CITIZEN_1, ward: Ward::District1, expires_at: 1 + KycValidityPeriod::get() }
				.into(),
		);
	});
}

#[test]
fn kyc_rejection_records_reason() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		assert_ok!(VendorDao::submit_kyc(
			RuntimeOrigin::signed(CITIZEN_1),
			Ward::District2,
			DocumentType::DriversLicense,
			[2u8; 32],
		));
		let reason: sp_runtime::BoundedVec<u8, _> = b"Document photo illegible".to_vec().try_into().unwrap();
		assert_ok!(VendorDao::set_kyc_status(RuntimeOrigin::root(), CITIZEN_1, false, Some(reason.clone())));

		let record = KycRecords::<Test>::get(CITIZEN_1).unwrap();
		assert_eq!(record.status, KycStatus::Rejected);
		assert_eq!(record.rejection_reason, Some(reason.clone()));
		assert_eq!(record.expires_at, None);
		System::assert_last_event(Event::KycRejected { who: CITIZEN_1, reason: Some(reason) }.into());
	});
}

#[test]
fn non_admin_cannot_decide_kyc() {
	new_test_ext().execute_with(|| {
		assert_ok!(VendorDao::submit_kyc(
			RuntimeOrigin::signed(CITIZEN_1),
			Ward::District1,
			DocumentType::Passport,
			[1u8; 32],
		));
		assert_noop!(
			VendorDao::set_kyc_status(RuntimeOrigin::signed(CITIZEN_2), CITIZEN_1, true, None),
			sp_runtime::DispatchError::BadOrigin
		);
	});
}

#[test]
fn cannot_decide_kyc_twice() {
	new_test_ext().execute_with(|| {
		assert_ok!(VendorDao::submit_kyc(
			RuntimeOrigin::signed(CITIZEN_1),
			Ward::District1,
			DocumentType::Passport,
			[1u8; 32],
		));
		assert_ok!(VendorDao::set_kyc_status(RuntimeOrigin::root(), CITIZEN_1, true, None));
		assert_noop!(
			VendorDao::set_kyc_status(RuntimeOrigin::root(), CITIZEN_1, true, None),
			Error::<Test>::KycNotPending
		);
	});
}

#[test]
fn deciding_kyc_without_a_request_fails() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			VendorDao::set_kyc_status(RuntimeOrigin::root(), CITIZEN_1, true, None),
			Error::<Test>::KycRecordNotFound
		);
	});
}

#[test]
fn ward_scoped_proposal_restricts_voting_to_residents() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);

		// CITIZEN_1 is a verified District1 resident; CITIZEN_2 has no KYC at all; CITIZEN_3 is
		// verified but for a different district.
		assert_ok!(VendorDao::submit_kyc(
			RuntimeOrigin::signed(CITIZEN_1),
			Ward::District1,
			DocumentType::Passport,
			[1u8; 32],
		));
		assert_ok!(VendorDao::set_kyc_status(RuntimeOrigin::root(), CITIZEN_1, true, None));
		assert_ok!(VendorDao::submit_kyc(
			RuntimeOrigin::signed(CITIZEN_3),
			Ward::District2,
			DocumentType::StateId,
			[3u8; 32],
		));
		assert_ok!(VendorDao::set_kyc_status(RuntimeOrigin::root(), CITIZEN_3, true, None));

		let id = ProposalCount::<Test>::get();
		assert_ok!(VendorDao::submit_proposal(
			RuntimeOrigin::signed(CITIZEN_1),
			VENDOR,
			b"Neighborhood Park Cleanup".to_vec().try_into().unwrap(),
			b"District 1 park cleanup and new benches".to_vec().try_into().unwrap(),
			5_000,
			Ward::District1,
			None,
		));
		assert_ok!(VendorDao::vet_proposal(RuntimeOrigin::root(), id, true));

		// A verified District1 resident can vote.
		assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_1), id, true));
		// No KYC at all: rejected.
		assert_noop!(
			VendorDao::vote(RuntimeOrigin::signed(CITIZEN_2), id, true),
			Error::<Test>::NotResidentOfWard
		);
		// Verified, but for the wrong district: rejected.
		assert_noop!(
			VendorDao::vote(RuntimeOrigin::signed(CITIZEN_3), id, true),
			Error::<Test>::NotResidentOfWard
		);
	});
}

#[test]
fn expired_kyc_blocks_voting_on_ward_scoped_proposals() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		assert_ok!(VendorDao::submit_kyc(
			RuntimeOrigin::signed(CITIZEN_1),
			Ward::District1,
			DocumentType::Passport,
			[1u8; 32],
		));
		assert_ok!(VendorDao::set_kyc_status(RuntimeOrigin::root(), CITIZEN_1, true, None));

		let id = ProposalCount::<Test>::get();
		assert_ok!(VendorDao::submit_proposal(
			RuntimeOrigin::signed(CITIZEN_1),
			VENDOR,
			b"Neighborhood Park Cleanup".to_vec().try_into().unwrap(),
			b"District 1 park cleanup and new benches".to_vec().try_into().unwrap(),
			5_000,
			Ward::District1,
			None,
		));
		assert_ok!(VendorDao::vet_proposal(RuntimeOrigin::root(), id, true));

		run_to_block(KycValidityPeriod::get() + 2);
		assert_noop!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_1), id, true), Error::<Test>::KycExpired);
	});
}

#[test]
fn citywide_proposal_open_to_any_voter() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		// No KYC/residency set up for anyone -- Citywide proposals must remain open to all.
		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);
		assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_2), id, true));
		assert_ok!(VendorDao::vote(RuntimeOrigin::signed(CITIZEN_3), id, false));
	});
}

#[test]
fn post_rfp_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		assert_ok!(VendorDao::post_rfp(
			RuntimeOrigin::root(),
			b"Repave District 3 side streets".to_vec().try_into().unwrap(),
			b"Repave approximately 2 miles of residential side streets.".to_vec().try_into().unwrap(),
			Ward::District3,
			50_000,
		));

		assert_eq!(RfpCount::<Test>::get(), 1);
		let rfp = Rfps::<Test>::get(0).unwrap();
		assert_eq!(rfp.ward, Ward::District3);
		assert_eq!(rfp.max_amount, 50_000);
		assert_eq!(rfp.status, RfpStatus::Open);
		System::assert_last_event(Event::RfpPosted { id: 0, ward: Ward::District3, max_amount: 50_000 }.into());
	});
}

#[test]
fn non_admin_cannot_post_rfp() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			VendorDao::post_rfp(
				RuntimeOrigin::signed(CITIZEN_1),
				b"Title".to_vec().try_into().unwrap(),
				b"Description".to_vec().try_into().unwrap(),
				Ward::Citywide,
				10_000,
			),
			sp_runtime::DispatchError::BadOrigin
		);
	});
}

#[test]
fn close_rfp_prevents_new_responses() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		assert_ok!(VendorDao::post_rfp(
			RuntimeOrigin::root(),
			b"Title".to_vec().try_into().unwrap(),
			b"Description".to_vec().try_into().unwrap(),
			Ward::District4,
			10_000,
		));
		assert_ok!(VendorDao::close_rfp(RuntimeOrigin::root(), 0));
		assert_eq!(Rfps::<Test>::get(0).unwrap().status, RfpStatus::Closed);

		assert_noop!(
			VendorDao::submit_proposal(
				RuntimeOrigin::signed(CITIZEN_1),
				VENDOR,
				b"Response".to_vec().try_into().unwrap(),
				b"Response description".to_vec().try_into().unwrap(),
				5_000,
				Ward::District4,
				Some(0),
			),
			Error::<Test>::RfpNotOpen
		);
	});
}

#[test]
fn submit_proposal_linked_to_rfp_validates_amount_and_ward() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		assert_ok!(VendorDao::post_rfp(
			RuntimeOrigin::root(),
			b"Title".to_vec().try_into().unwrap(),
			b"Description".to_vec().try_into().unwrap(),
			Ward::District5,
			10_000,
		));

		// Amount over the RFP's max is rejected.
		assert_noop!(
			VendorDao::submit_proposal(
				RuntimeOrigin::signed(CITIZEN_1),
				VENDOR,
				b"Too expensive".to_vec().try_into().unwrap(),
				b"Description".to_vec().try_into().unwrap(),
				20_000,
				Ward::District5,
				Some(0),
			),
			Error::<Test>::RfpAmountExceeded
		);

		// A ward that doesn't match the RFP's ward is rejected.
		assert_noop!(
			VendorDao::submit_proposal(
				RuntimeOrigin::signed(CITIZEN_1),
				VENDOR,
				b"Wrong ward".to_vec().try_into().unwrap(),
				b"Description".to_vec().try_into().unwrap(),
				5_000,
				Ward::District6,
				Some(0),
			),
			Error::<Test>::WardMismatch
		);

		// A conforming response succeeds and links back to the RFP.
		let id = ProposalCount::<Test>::get();
		assert_ok!(VendorDao::submit_proposal(
			RuntimeOrigin::signed(CITIZEN_1),
			VENDOR,
			b"Good response".to_vec().try_into().unwrap(),
			b"Description".to_vec().try_into().unwrap(),
			5_000,
			Ward::District5,
			Some(0),
		));
		let proposal = Proposals::<Test>::get(id).unwrap();
		assert_eq!(proposal.rfp_id, Some(0));
		assert_eq!(proposal.ward, Ward::District5);
	});
}

#[test]
fn vendor_can_post_spending_receipt_against_funded_proposal() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);
		fund_and_approve(id, 5_000);
		assert_eq!(Proposals::<Test>::get(id).unwrap().status, ProposalStatus::Funded);

		assert_ok!(VendorDao::post_spending_receipt(
			RuntimeOrigin::signed(VENDOR),
			id,
			3_000,
			b"Materials".to_vec().try_into().unwrap(),
			b"Asphalt and gravel for Main St repaving.".to_vec().try_into().unwrap(),
			Some([9u8; 32]),
		));

		assert_eq!(SpendingReceiptCount::<Test>::get(id), 1);
		let receipt = SpendingReceipts::<Test>::get(id, 0).unwrap();
		assert_eq!(receipt.vendor, VENDOR);
		assert_eq!(receipt.amount, 3_000);
		assert_eq!(receipt.attachment_hash, Some([9u8; 32]));
		System::assert_last_event(
			Event::SpendingReceiptPosted { proposal_id: id, id: 0, vendor: VENDOR, amount: 3_000 }.into(),
		);

		// A second receipt can bring the running total up to (but not over) the disbursed amount.
		assert_ok!(VendorDao::post_spending_receipt(
			RuntimeOrigin::signed(VENDOR),
			id,
			2_000,
			b"Labor".to_vec().try_into().unwrap(),
			b"Crew wages for the 3-day repaving job.".to_vec().try_into().unwrap(),
			None,
		));
		assert_eq!(SpendingReceiptCount::<Test>::get(id), 2);
		assert_eq!(SpendingReceipts::<Test>::get(id, 1).unwrap().attachment_hash, None);
	});
}

#[test]
fn receipt_cannot_exceed_disbursed_amount() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);
		fund_and_approve(id, 5_000);

		assert_ok!(VendorDao::post_spending_receipt(
			RuntimeOrigin::signed(VENDOR),
			id,
			4_000,
			b"Materials".to_vec().try_into().unwrap(),
			b"Asphalt and gravel.".to_vec().try_into().unwrap(),
			None,
		));
		assert_noop!(
			VendorDao::post_spending_receipt(
				RuntimeOrigin::signed(VENDOR),
				id,
				2_000,
				b"Labor".to_vec().try_into().unwrap(),
				b"Crew wages.".to_vec().try_into().unwrap(),
				None,
			),
			Error::<Test>::ReceiptExceedsDisbursedAmount
		);
	});
}

#[test]
fn only_proposal_vendor_can_post_receipt() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);
		fund_and_approve(id, 5_000);

		assert_noop!(
			VendorDao::post_spending_receipt(
				RuntimeOrigin::signed(CITIZEN_1),
				id,
				1_000,
				b"Materials".to_vec().try_into().unwrap(),
				b"Not the vendor.".to_vec().try_into().unwrap(),
				None,
			),
			Error::<Test>::NotProposalVendor
		);
	});
}

#[test]
fn cannot_post_receipt_before_proposal_funded() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);
		register_vendor(VENDOR);
		let id = submit_test_proposal(CITIZEN_1, VENDOR, 5_000);

		assert_noop!(
			VendorDao::post_spending_receipt(
				RuntimeOrigin::signed(VENDOR),
				id,
				1_000,
				b"Materials".to_vec().try_into().unwrap(),
				b"Too early.".to_vec().try_into().unwrap(),
				None,
			),
			Error::<Test>::ProposalNotFunded
		);
	});
}
