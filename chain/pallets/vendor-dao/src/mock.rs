use crate as pallet_vendor_dao;
use frame_support::{
	derive_impl, parameter_types,
	traits::{ConstU128, ConstU32, SortedMembers, VariantCountOf},
	PalletId,
};
use frame_system::{EnsureRoot, EnsureSignedBy};
use sp_runtime::BuildStorage;

type Block = frame_system::mocking::MockBlock<Test>;
pub type AccountId = u64;
pub type Balance = u128;

/// The only account allowed to call `stake_mint` in tests (stands in for a Stripe payment
/// gateway backend's own dedicated on-chain account).
pub const PAYMENT_GATEWAY: AccountId = 99;

pub struct PaymentGatewayAccounts;
impl SortedMembers<AccountId> for PaymentGatewayAccounts {
	fn sorted_members() -> Vec<AccountId> {
		vec![PAYMENT_GATEWAY]
	}
}

#[frame_support::runtime]
mod runtime {
	#[runtime::runtime]
	#[runtime::derive(
		RuntimeCall,
		RuntimeEvent,
		RuntimeError,
		RuntimeOrigin,
		RuntimeFreezeReason,
		RuntimeHoldReason,
		RuntimeSlashReason,
		RuntimeLockId,
		RuntimeTask,
		RuntimeViewFunction
	)]
	pub struct Test;

	#[runtime::pallet_index(0)]
	pub type System = frame_system::Pallet<Test>;

	#[runtime::pallet_index(1)]
	pub type Balances = pallet_balances::Pallet<Test>;

	#[runtime::pallet_index(2)]
	pub type VendorDao = pallet_vendor_dao::Pallet<Test>;
}

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
	type Block = Block;
	type AccountId = AccountId;
	type AccountData = pallet_balances::AccountData<Balance>;
}

impl pallet_balances::Config for Test {
	type MaxLocks = ConstU32<50>;
	type MaxReserves = ();
	type ReserveIdentifier = [u8; 8];
	type Balance = Balance;
	type RuntimeEvent = RuntimeEvent;
	type DustRemoval = ();
	type ExistentialDeposit = ConstU128<1>;
	type AccountStore = System;
	type WeightInfo = ();
	type FreezeIdentifier = RuntimeFreezeReason;
	type MaxFreezes = VariantCountOf<RuntimeFreezeReason>;
	type RuntimeHoldReason = RuntimeHoldReason;
	type RuntimeFreezeReason = RuntimeFreezeReason;
	type DoneSlashHandler = ();
}

parameter_types! {
	pub const TreasuryPalletId: PalletId = PalletId(*b"py/vddao");
	pub const VotingPeriod: u64 = 10;
	pub const MinimumQuorum: u32 = 3;
	pub const MaxProposalAmount: Balance = 1_000_000_000;
	pub const KycValidityPeriod: u64 = 5;
}

impl pallet_vendor_dao::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type NativeBalance = Balances;
	type TreasuryPalletId = TreasuryPalletId;
	type VotingPeriod = VotingPeriod;
	type MinimumQuorum = MinimumQuorum;
	type MaxProposalAmount = MaxProposalAmount;
	type MaxTitleLen = ConstU32<64>;
	type MaxDescriptionLen = ConstU32<512>;
	type MaxVendorNameLen = ConstU32<64>;
	type MaxVendorDescriptionLen = ConstU32<512>;
	type MaxContactLen = ConstU32<128>;
	type MaxBusinessAddressLen = ConstU32<128>;
	type MaxWebsiteLen = ConstU32<128>;
	type MaxUpdateContentLen = ConstU32<512>;
	type MaxDonorNameLen = ConstU32<64>;
	type MaxGrantPurposeLen = ConstU32<512>;
	type MaxRejectionReasonLen = ConstU32<256>;
	type KycValidityPeriod = KycValidityPeriod;
	type MaxReceiptCategoryLen = ConstU32<64>;
	type MaxReceiptDescriptionLen = ConstU32<512>;
	type PaymentGatewayOrigin = EnsureSignedBy<PaymentGatewayAccounts, AccountId>;
	type AdminOrigin = EnsureRoot<AccountId>;
}

// Build genesis storage according to the mock runtime.
pub fn new_test_ext() -> sp_io::TestExternalities {
	let mut t = frame_system::GenesisConfig::<Test>::default().build_storage().unwrap();
	pallet_balances::GenesisConfig::<Test> {
		balances: vec![(1, 1_000_000_000), (2, 1_000_000_000), (3, 1_000_000_000), (4, 1_000_000_000)],
		..Default::default()
	}
	.assimilate_storage(&mut t)
	.unwrap();
	t.into()
}
