use crate::{
	mock::*, Error, Event, ProposalCount, ProposalStatus, Proposals, VendorCategory, VendorUpdateCount,
	VendorUpdates, Vendors,
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
	));
	id
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
