//! # VendorDAO Pallet
//!
//! An open, transparent governance pallet for citywide vendor funding.
//!
//! ## Overview
//!
//! VendorDAO lets a community fund a public, on-chain treasury ("the ledger of funds") and
//! collectively decide - through open voting - which registered vendors receive payouts for
//! proposed civic work. Every step of the process is public and auditable on-chain:
//!
//! - **Vendor registry**: any account can register as a vendor. A privileged [`Config::AdminOrigin`]
//!   (e.g. the city / a council) can mark a vendor as "verified" as a trust signal, without
//!   blocking anyone from registering or proposing.
//! - **Proposals**: any signed account may submit a funding proposal on behalf of a registered
//!   vendor, requesting an amount of funds for a described piece of work.
//! - **Voting**: token holders vote aye/nay, one account = one vote. Every vote is recorded
//!   on-chain (transparent), and an account cannot vote twice on the same proposal.
//! - **Tallying & disbursement**: once the voting period ends, anyone can trigger tallying. If the
//!   proposal reaches the configured quorum and a simple majority of ayes, it is approved and the
//!   requested amount is transferred from the public treasury pot directly to the vendor.
//! - **Treasury ("ledger of funds")**: anyone can contribute funds to the public pot. The running
//!   totals received/disbursed and the pot's live balance provide a fully transparent funding
//!   ledger for the whole city to inspect.
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[frame_support::pallet]
pub mod pallet {
	use frame_support::{
		pallet_prelude::*,
		traits::{
			fungible::{Inspect, Mutate},
			tokens::Preservation,
			EnsureOrigin,
		},
		CloneNoBound, EqNoBound, PalletId, PartialEqNoBound, RuntimeDebugNoBound,
	};
	use frame_system::pallet_prelude::*;
	use sp_runtime::traits::{AccountIdConversion, Saturating, Zero};

	/// Convenience alias for this pallet's configured balance type.
	pub type BalanceOf<T> =
		<<T as Config>::NativeBalance as Inspect<<T as frame_system::Config>::AccountId>>::Balance;

	/// Identifies a single funding proposal.
	pub type ProposalId = u32;

	/// Identifies a single vendor update post (scoped to its posting vendor).
	pub type UpdateId = u32;

	/// Identifies a single recorded grant in the donor/grants registry.
	pub type GrantId = u32;

	/// Identifies a single city-posted request for proposals (RFP).
	pub type RfpId = u32;

	/// Identifies a single spending receipt posted against a funded proposal.
	pub type ReceiptId = u32;

	#[pallet::pallet]
	#[pallet::without_storage_info]
	pub struct Pallet<T>(_);

	#[pallet::config]
	pub trait Config: frame_system::Config {
		/// The overarching runtime event type.
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// The fungible token implementation backing the public treasury and vendor payouts.
		type NativeBalance: Inspect<Self::AccountId> + Mutate<Self::AccountId>;

		/// Pallet ID used to derive the sovereign treasury ("ledger of funds") account.
		#[pallet::constant]
		type TreasuryPalletId: Get<PalletId>;

		/// How many blocks a proposal stays open for voting.
		#[pallet::constant]
		type VotingPeriod: Get<BlockNumberFor<Self>>;

		/// Minimum number of total votes (ayes + nays) a proposal needs before it can pass.
		#[pallet::constant]
		type MinimumQuorum: Get<u32>;

		/// Maximum amount of funds a single proposal may request.
		#[pallet::constant]
		type MaxProposalAmount: Get<BalanceOf<Self>>;

		/// Maximum length (in bytes) of a proposal title.
		type MaxTitleLen: Get<u32>;

		/// Maximum length (in bytes) of a proposal description.
		type MaxDescriptionLen: Get<u32>;

		/// Maximum length (in bytes) of a vendor's display name.
		type MaxVendorNameLen: Get<u32>;

		/// Maximum length (in bytes) of a vendor's free-text description of services offered.
		type MaxVendorDescriptionLen: Get<u32>;

		/// Maximum length (in bytes) of a vendor's verified email address.
		type MaxContactLen: Get<u32>;

		/// Maximum length (in bytes) of a vendor's business/mailing address.
		type MaxBusinessAddressLen: Get<u32>;

		/// Maximum length (in bytes) of a vendor's website URL.
		type MaxWebsiteLen: Get<u32>;

		/// Maximum length (in bytes) of a single vendor update post.
		type MaxUpdateContentLen: Get<u32>;

		/// Maximum length (in bytes) of a donor's display name.
		type MaxDonorNameLen: Get<u32>;

		/// Maximum length (in bytes) of a grant's stated purpose.
		type MaxGrantPurposeLen: Get<u32>;

		/// Maximum length (in bytes) of an admin's stated KYC rejection reason.
		type MaxRejectionReasonLen: Get<u32>;

		/// How many blocks a verified KYC record remains valid before it must be renewed.
		#[pallet::constant]
		type KycValidityPeriod: Get<BlockNumberFor<Self>>;

		/// Maximum length (in bytes) of a spending receipt's category label.
		type MaxReceiptCategoryLen: Get<u32>;

		/// Maximum length (in bytes) of a spending receipt's description.
		type MaxReceiptDescriptionLen: Get<u32>;

		/// Privileged origin allowed to mint newly-staked tokens (e.g. a fiat payment gateway
		/// backend that has confirmed an off-chain card payment). Distinct from [`Config::AdminOrigin`]
		/// so a compromised payment-gateway key can only ever mint stake, never anything else.
		type PaymentGatewayOrigin: EnsureOrigin<Self::RuntimeOrigin>;

		/// Privileged origin allowed to mark a vendor as verified (e.g. the city council).
		type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	/// Standard municipal procurement category a vendor operates under.
	#[derive(
		Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen,
	)]
	pub enum VendorCategory {
		/// Construction, demolition, and building rehabilitation.
		Construction,
		/// Parks, recreation centers, and green space.
		ParksAndRecreation,
		/// Public art, murals, and cultural programming.
		ArtsAndCulture,
		/// Environmental remediation and green infrastructure.
		Environmental,
		/// Affordable housing and residential rehabilitation.
		Housing,
		/// Roads, utilities, and general infrastructure.
		Infrastructure,
		/// Civic technology and digital services.
		Technology,
		/// Urban agriculture and food access.
		FoodAndAgriculture,
		/// Youth programs and community services.
		YouthAndCommunity,
		/// Public safety and emergency services.
		PublicSafety,
		/// Anything not covered by the categories above.
		Other,
	}

	/// A Detroit City Council district a proposal or resident is scoped to. Proposals tagged
	/// `Citywide` are open to every voter; any other variant restricts voting to verified
	/// residents of that same district (see [`Pallet::vote`]).
	#[derive(
		Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen,
	)]
	pub enum Ward {
		District1,
		District2,
		District3,
		District4,
		District5,
		District6,
		District7,
		/// Not scoped to a single ward - open to every verified resident regardless of district.
		Citywide,
	}

	/// The lifecycle status of a funding proposal.
	#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo)]
	pub enum ProposalStatus {
		/// Submitted, awaiting admin vetting before it can open for public voting.
		PendingReview,
		/// Vetted and open for voting.
		Proposed,
		/// Passed quorum + majority, awaiting or pending disbursement.
		Approved,
		/// Did not reach quorum or majority.
		Rejected,
		/// Approved and successfully paid out to the vendor.
		Funded,
		/// Withdrawn by its proposer before voting closed.
		Cancelled,
		/// Vetoed by the admin during vetting; never opened for a public vote.
		Vetoed,
	}

	/// A citywide vendor-funding proposal.
	#[derive(Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, RuntimeDebugNoBound, TypeInfo)]
	#[scale_info(skip_type_params(T))]
	pub struct Proposal<T: Config> {
		/// The account that submitted the proposal.
		pub proposer: T::AccountId,
		/// The registered vendor who would receive the funds if approved.
		pub vendor: T::AccountId,
		/// Short human-readable title (translated client-side for display).
		pub title: BoundedVec<u8, T::MaxTitleLen>,
		/// Longer description of the proposed work (translated client-side for display).
		pub description: BoundedVec<u8, T::MaxDescriptionLen>,
		/// Amount requested from the public treasury.
		pub amount: BalanceOf<T>,
		/// Current lifecycle status.
		pub status: ProposalStatus,
		/// Number of "aye" votes recorded so far.
		pub ayes: u32,
		/// Number of "nay" votes recorded so far.
		pub nays: u32,
		/// Block at which the proposal was submitted.
		pub created_at: BlockNumberFor<T>,
		/// Block at which voting closes.
		pub voting_end: BlockNumberFor<T>,
		/// The neighborhood/district this proposal is scoped to for voting eligibility.
		pub ward: Ward,
		/// The RFP this proposal responds to, if any.
		pub rfp_id: Option<RfpId>,
	}

	/// Public, on-chain profile of a registered vendor.
	#[derive(Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, RuntimeDebugNoBound, TypeInfo)]
	#[scale_info(skip_type_params(T))]
	pub struct VendorInfo<T: Config> {
		/// Vendor's public display name.
		pub name: BoundedVec<u8, T::MaxVendorNameLen>,
		/// Standard procurement category this vendor operates under.
		pub category: VendorCategory,
		/// Free-text description of the services this vendor offers.
		pub description: BoundedVec<u8, T::MaxVendorDescriptionLen>,
		/// Vendor's verified email address (confirmed off-chain before registration).
		pub contact: BoundedVec<u8, T::MaxContactLen>,
		/// Vendor's business / mailing address.
		pub business_address: BoundedVec<u8, T::MaxBusinessAddressLen>,
		/// Vendor's website URL, if any.
		pub website: BoundedVec<u8, T::MaxWebsiteLen>,
		/// Whether the city / admin origin has verified this vendor.
		pub verified: bool,
		/// Block at which the vendor registered.
		pub registered_at: BlockNumberFor<T>,
		/// Running total of funds this vendor has received.
		pub total_received: BalanceOf<T>,
		/// Number of proposals that have been funded for this vendor.
		pub proposals_funded: u32,
	}

	/// A public progress update a vendor posts about funded civic work.
	#[derive(Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, RuntimeDebugNoBound, TypeInfo)]
	#[scale_info(skip_type_params(T))]
	pub struct VendorUpdate<T: Config> {
		/// The vendor account that posted this update.
		pub vendor: T::AccountId,
		/// Free-text update content (translated client-side for display).
		pub content: BoundedVec<u8, T::MaxUpdateContentLen>,
		/// The funded proposal this update reports progress on, if any.
		pub proposal_id: Option<ProposalId>,
		/// Block at which the update was posted.
		pub posted_at: BlockNumberFor<T>,
	}

	/// An itemized record of how part of a funded proposal's disbursed funds were spent.
	#[derive(Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, RuntimeDebugNoBound, TypeInfo)]
	#[scale_info(skip_type_params(T))]
	pub struct SpendingReceipt<T: Config> {
		/// The funded proposal this receipt reports spending against.
		pub proposal_id: ProposalId,
		/// The vendor account that posted this receipt.
		pub vendor: T::AccountId,
		/// Amount this receipt accounts for.
		pub amount: BalanceOf<T>,
		/// Short label for the kind of spending (e.g. "Materials", "Labor").
		pub category: BoundedVec<u8, T::MaxReceiptCategoryLen>,
		/// Free-text description of what was purchased or paid for.
		pub description: BoundedVec<u8, T::MaxReceiptDescriptionLen>,
		/// SHA-256 hash of an optional attached photo/scan of the physical receipt or invoice,
		/// computed client-side. The chain only ever stores this hash -- never the media itself.
		pub attachment_hash: Option<[u8; 32]>,
		/// Block at which the receipt was posted.
		pub posted_at: BlockNumberFor<T>,
	}

	/// The kind of entity behind a registered donor.
	#[derive(Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum DonorType {
		/// A private individual.
		Individual,
		/// A charitable foundation.
		Foundation,
		/// A for-profit business.
		Corporation,
		/// A government body (city, state, federal).
		Government,
		/// Anything not covered by the categories above.
		Other,
	}

	/// Public, on-chain profile of a registered donor/grantmaker.
	#[derive(Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, RuntimeDebugNoBound, TypeInfo)]
	#[scale_info(skip_type_params(T))]
	pub struct DonorInfo<T: Config> {
		/// Donor's public display name.
		pub name: BoundedVec<u8, T::MaxDonorNameLen>,
		/// What kind of entity this donor is.
		pub donor_type: DonorType,
		/// Block at which the donor registered.
		pub registered_at: BlockNumberFor<T>,
		/// Lifetime total this donor has contributed via [`Pallet::submit_grant`].
		pub total_contributed: BalanceOf<T>,
		/// Number of grants this donor has submitted.
		pub grants_made: u32,
	}

	/// A named, purpose-labeled contribution recorded in the public grants registry.
	#[derive(Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, RuntimeDebugNoBound, TypeInfo)]
	#[scale_info(skip_type_params(T))]
	pub struct Grant<T: Config> {
		/// The registered donor who submitted this grant.
		pub donor: T::AccountId,
		/// Amount contributed to the public treasury as part of this grant.
		pub amount: BalanceOf<T>,
		/// Free-text statement of what the grant is intended to support.
		pub purpose: BoundedVec<u8, T::MaxGrantPurposeLen>,
		/// Block at which the grant was submitted.
		pub submitted_at: BlockNumberFor<T>,
	}

	/// The lifecycle status of a city-posted request for proposals.
	#[derive(
		Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen,
	)]
	pub enum RfpStatus {
		/// Open for vendor proposal responses.
		Open,
		/// No longer accepting new proposal responses.
		Closed,
	}

	/// A city-posted request for proposals: a defined civic need, scoped to a ward, that
	/// vendors may respond to with a funding proposal (see [`Pallet::submit_proposal`]).
	#[derive(Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, RuntimeDebugNoBound, TypeInfo)]
	#[scale_info(skip_type_params(T))]
	pub struct Rfp<T: Config> {
		/// Short human-readable title.
		pub title: BoundedVec<u8, T::MaxTitleLen>,
		/// Longer description of the civic need.
		pub description: BoundedVec<u8, T::MaxDescriptionLen>,
		/// The ward this need is scoped to.
		pub ward: Ward,
		/// The maximum amount any single responding proposal may request.
		pub max_amount: BalanceOf<T>,
		/// Current lifecycle status.
		pub status: RfpStatus,
		/// Block at which the RFP was posted.
		pub created_at: BlockNumberFor<T>,
	}

	/// The lifecycle status of a resident's identity-verification (KYC) request.
	#[derive(
		Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen,
	)]
	pub enum KycStatus {
		/// Submitted, awaiting admin review.
		Pending,
		/// Approved by the admin origin; valid until the record's `expires_at` block.
		Verified,
		/// Rejected by the admin origin.
		Rejected,
	}

	/// The kind of government-issued ID document presented for identity verification (KYC).
	#[derive(
		Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen,
	)]
	pub enum DocumentType {
		Passport,
		DriversLicense,
		StateId,
		NationalId,
	}

	/// A resident's identity-verification (KYC) request. VendorDAO never receives or stores the
	/// applicant's underlying personal data: `document_hash` is a one-way SHA-256 hash of their
	/// full legal name, date of birth, and document number, computed client-side before this is
	/// ever submitted, exactly as a real KYC/AML system keeps PII out of any public, permanent
	/// ledger and only records a verification attestation.
	#[derive(Encode, Decode, CloneNoBound, PartialEqNoBound, EqNoBound, RuntimeDebugNoBound, TypeInfo)]
	#[scale_info(skip_type_params(T))]
	pub struct KycRecord<T: Config> {
		/// The ward this resident has declared.
		pub ward: Ward,
		/// The type of government-issued ID document presented.
		pub document_type: DocumentType,
		/// SHA-256 hash of the applicant's full name, date of birth, and document number.
		pub document_hash: [u8; 32],
		/// Current review status.
		pub status: KycStatus,
		/// Block at which the request was submitted (or most recently resubmitted).
		pub submitted_at: BlockNumberFor<T>,
		/// Block at which the request was most recently approved, if ever.
		pub verified_at: Option<BlockNumberFor<T>>,
		/// Block at which this verification expires and must be renewed, if approved.
		pub expires_at: Option<BlockNumberFor<T>>,
		/// The admin's stated reason for rejection, if rejected.
		pub rejection_reason: Option<BoundedVec<u8, T::MaxRejectionReasonLen>>,
	}

	/// Incrementing counter used to allocate the next [`ProposalId`].
	#[pallet::storage]
	pub type ProposalCount<T> = StorageValue<_, ProposalId, ValueQuery>;

	/// All proposals ever submitted, keyed by [`ProposalId`].
	#[pallet::storage]
	pub type Proposals<T: Config> = StorageMap<_, Blake2_128Concat, ProposalId, Proposal<T>, OptionQuery>;

	/// Records each account's vote (`true` = aye, `false` = nay) on a given proposal.
	#[pallet::storage]
	pub type VoteOf<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		ProposalId,
		Blake2_128Concat,
		T::AccountId,
		bool,
		OptionQuery,
	>;

	/// The public vendor registry.
	#[pallet::storage]
	pub type Vendors<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, VendorInfo<T>, OptionQuery>;

	/// Incrementing per-vendor counter used to allocate the next [`UpdateId`].
	#[pallet::storage]
	pub type VendorUpdateCount<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, UpdateId, ValueQuery>;

	/// Public feed of vendor progress updates, keyed by (vendor, per-vendor update index).
	#[pallet::storage]
	pub type VendorUpdates<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		Blake2_128Concat,
		UpdateId,
		VendorUpdate<T>,
		OptionQuery,
	>;

	/// The public donor/grantmaker registry.
	#[pallet::storage]
	pub type Donors<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, DonorInfo<T>, OptionQuery>;

	/// Incrementing counter used to allocate the next [`GrantId`].
	#[pallet::storage]
	pub type GrantCount<T> = StorageValue<_, GrantId, ValueQuery>;

	/// All grants ever submitted, keyed by [`GrantId`].
	#[pallet::storage]
	pub type Grants<T: Config> = StorageMap<_, Blake2_128Concat, GrantId, Grant<T>, OptionQuery>;

	/// Lifetime total of funds ever contributed to the public treasury.
	#[pallet::storage]
	pub type TotalFundsReceived<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// Lifetime total of funds ever disbursed to vendors.
	#[pallet::storage]
	pub type TotalFundsDisbursed<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// Incrementing counter used to allocate the next [`RfpId`].
	#[pallet::storage]
	pub type RfpCount<T> = StorageValue<_, RfpId, ValueQuery>;

	/// All RFPs ever posted, keyed by [`RfpId`].
	#[pallet::storage]
	pub type Rfps<T: Config> = StorageMap<_, Blake2_128Concat, RfpId, Rfp<T>, OptionQuery>;

	/// Each account's identity-verification (KYC) request and self-declared ward.
	#[pallet::storage]
	pub type KycRecords<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, KycRecord<T>, OptionQuery>;

	/// Incrementing per-proposal counter used to allocate the next [`ReceiptId`] for that proposal.
	#[pallet::storage]
	pub type SpendingReceiptCount<T> = StorageMap<_, Blake2_128Concat, ProposalId, ReceiptId, ValueQuery>;

	/// Itemized spending receipts posted against a funded proposal, keyed by (proposal, per-proposal
	/// receipt index).
	#[pallet::storage]
	pub type SpendingReceipts<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		ProposalId,
		Blake2_128Concat,
		ReceiptId,
		SpendingReceipt<T>,
		OptionQuery,
	>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// A new vendor registered in the public registry.
		VendorRegistered {
			who: T::AccountId,
			name: BoundedVec<u8, T::MaxVendorNameLen>,
			category: VendorCategory,
		},
		/// A vendor updated their public profile (category, description, or contact info).
		VendorProfileUpdated { who: T::AccountId },
		/// The admin origin updated a vendor's verification status.
		VendorVerified { who: T::AccountId, verified: bool },
		/// A vendor posted a public update about funded work.
		VendorUpdatePosted { vendor: T::AccountId, id: UpdateId, proposal_id: Option<ProposalId> },
		/// A new proposal was submitted; awaiting admin vetting before it can open for voting.
		ProposalSubmitted { id: ProposalId, proposer: T::AccountId, vendor: T::AccountId, amount: BalanceOf<T> },
		/// The admin vetted a proposal as fit for public voting.
		ProposalVetted { id: ProposalId, voting_end: BlockNumberFor<T> },
		/// The admin vetoed a proposal during vetting; it never opened for a public vote.
		ProposalVetoed { id: ProposalId },
		/// A vote was cast on a proposal.
		VoteCast { id: ProposalId, voter: T::AccountId, approve: bool, ayes: u32, nays: u32 },
		/// A proposal reached quorum and a majority of ayes.
		ProposalApproved { id: ProposalId, ayes: u32, nays: u32 },
		/// A proposal failed to reach quorum or a majority of ayes.
		ProposalRejected { id: ProposalId, ayes: u32, nays: u32 },
		/// A proposer withdrew their proposal before voting closed.
		ProposalCancelled { id: ProposalId },
		/// An approved proposal was paid out to its vendor.
		ProposalFunded { id: ProposalId, vendor: T::AccountId, amount: BalanceOf<T> },
		/// A proposal was approved but the treasury currently lacks sufficient funds.
		DisbursementPending { id: ProposalId, amount: BalanceOf<T> },
		/// An account contributed funds to the public treasury.
		TreasuryFunded { from: T::AccountId, amount: BalanceOf<T>, pot_balance: BalanceOf<T> },
		/// A new donor registered in the public donor/grants registry.
		DonorRegistered { who: T::AccountId, name: BoundedVec<u8, T::MaxDonorNameLen>, donor_type: DonorType },
		/// A registered donor submitted a named, purpose-labeled grant to the public treasury.
		GrantSubmitted { id: GrantId, donor: T::AccountId, amount: BalanceOf<T> },
		/// The payment gateway minted newly-staked tokens for an off-chain fiat payment (e.g. Stripe).
		TokensStaked { who: T::AccountId, amount: BalanceOf<T> },
		/// A city admin posted a new request for proposals.
		RfpPosted { id: RfpId, ward: Ward, max_amount: BalanceOf<T> },
		/// An admin closed an RFP to new proposal responses.
		RfpClosed { id: RfpId },
		/// A resident submitted (or resubmitted) a KYC request declaring their ward.
		KycSubmitted { who: T::AccountId, ward: Ward },
		/// The admin verified a resident's KYC request; the declared ward is now locked in until
		/// `expires_at`.
		KycVerified { who: T::AccountId, ward: Ward, expires_at: BlockNumberFor<T> },
		/// The admin rejected a resident's KYC request, optionally with a stated reason.
		KycRejected { who: T::AccountId, reason: Option<BoundedVec<u8, T::MaxRejectionReasonLen>> },
		/// A vendor posted an itemized spending receipt against a funded proposal.
		SpendingReceiptPosted { proposal_id: ProposalId, id: ReceiptId, vendor: T::AccountId, amount: BalanceOf<T> },
	}

	#[pallet::error]
	pub enum Error<T> {
		/// The vendor referenced by a proposal is not in the registry.
		VendorNotRegistered,
		/// This account has already registered as a vendor.
		VendorAlreadyRegistered,
		/// No proposal exists with the given id.
		ProposalNotFound,
		/// Only the original proposer may perform this action.
		NotProposer,
		/// The proposal is not currently open for voting.
		ProposalNotOpen,
		/// The voting period for this proposal has already ended.
		VotingPeriodEnded,
		/// The voting period for this proposal has not ended yet.
		VotingPeriodNotEnded,
		/// This account has already voted on this proposal.
		AlreadyVoted,
		/// The requested amount must be greater than zero.
		ZeroAmount,
		/// The requested amount exceeds the configured per-proposal maximum.
		AmountExceedsMax,
		/// The proposal has not been approved.
		ProposalNotApproved,
		/// The public treasury does not currently hold enough funds.
		InsufficientTreasuryFunds,
		/// The referenced proposal is not associated with the caller's own vendor account.
		NotProposalVendor,
		/// This account has not registered as a donor.
		DonorNotRegistered,
		/// This account has already registered as a donor.
		DonorAlreadyRegistered,
		/// The proposal is not awaiting vetting (already vetted, vetoed, or otherwise resolved).
		ProposalNotPendingReview,
		/// No RFP exists with the given id.
		RfpNotFound,
		/// The RFP is no longer open for new proposal responses.
		RfpNotOpen,
		/// The proposal amount exceeds the RFP's stated maximum.
		RfpAmountExceeded,
		/// The proposal's ward does not match the RFP it responds to.
		WardMismatch,
		/// No KYC request exists for this account.
		KycRecordNotFound,
		/// The KYC request is not awaiting review (already verified or rejected).
		KycNotPending,
		/// Voting on this proposal is restricted to verified residents of its ward.
		NotResidentOfWard,
		/// The account's KYC verification has expired and must be renewed.
		KycExpired,
		/// The proposal has not yet been funded, so no spending can be receipted against it.
		ProposalNotFunded,
		/// The receipted amount would push the running total over the amount actually disbursed.
		ReceiptExceedsDisbursedAmount,
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Register the caller as a vendor eligible to receive proposal funding.
		#[pallet::call_index(0)]
		#[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
		pub fn register_vendor(
			origin: OriginFor<T>,
			name: BoundedVec<u8, T::MaxVendorNameLen>,
			category: VendorCategory,
			description: BoundedVec<u8, T::MaxVendorDescriptionLen>,
			contact: BoundedVec<u8, T::MaxContactLen>,
			business_address: BoundedVec<u8, T::MaxBusinessAddressLen>,
			website: BoundedVec<u8, T::MaxWebsiteLen>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(!Vendors::<T>::contains_key(&who), Error::<T>::VendorAlreadyRegistered);

			Vendors::<T>::insert(
				&who,
				VendorInfo {
					name: name.clone(),
					category,
					description,
					contact,
					business_address,
					website,
					verified: false,
					registered_at: frame_system::Pallet::<T>::block_number(),
					total_received: Zero::zero(),
					proposals_funded: 0,
				},
			);

			Self::deposit_event(Event::VendorRegistered { who, name, category });
			Ok(())
		}

		/// Update the caller's own vendor profile (category, description, contact, address, website).
		#[pallet::call_index(8)]
		#[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
		pub fn update_vendor_profile(
			origin: OriginFor<T>,
			category: VendorCategory,
			description: BoundedVec<u8, T::MaxVendorDescriptionLen>,
			contact: BoundedVec<u8, T::MaxContactLen>,
			business_address: BoundedVec<u8, T::MaxBusinessAddressLen>,
			website: BoundedVec<u8, T::MaxWebsiteLen>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			Vendors::<T>::try_mutate(&who, |maybe_info| -> DispatchResult {
				let info = maybe_info.as_mut().ok_or(Error::<T>::VendorNotRegistered)?;
				info.category = category;
				info.description = description;
				info.contact = contact;
				info.business_address = business_address;
				info.website = website;
				Ok(())
			})?;

			Self::deposit_event(Event::VendorProfileUpdated { who });
			Ok(())
		}

		/// Mark a vendor as verified (or unverified). Restricted to [`Config::AdminOrigin`].
		#[pallet::call_index(1)]
		#[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
		pub fn set_vendor_verified(origin: OriginFor<T>, vendor: T::AccountId, verified: bool) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;

			Vendors::<T>::try_mutate(&vendor, |maybe_info| -> DispatchResult {
				let info = maybe_info.as_mut().ok_or(Error::<T>::VendorNotRegistered)?;
				info.verified = verified;
				Ok(())
			})?;

			Self::deposit_event(Event::VendorVerified { who: vendor, verified });
			Ok(())
		}

		/// Submit a new funding proposal on behalf of a registered vendor. Starts out
		/// `PendingReview`; an admin must [`Pallet::vet_proposal`] it before the public can vote.
		/// If `rfp_id` is `Some`, the proposal responds to that RFP: the RFP must be `Open`, and
		/// `ward`/`amount` must respect the RFP's ward and maximum amount.
		#[pallet::call_index(2)]
		#[pallet::weight(T::DbWeight::get().reads_writes(3, 2))]
		pub fn submit_proposal(
			origin: OriginFor<T>,
			vendor: T::AccountId,
			title: BoundedVec<u8, T::MaxTitleLen>,
			description: BoundedVec<u8, T::MaxDescriptionLen>,
			amount: BalanceOf<T>,
			ward: Ward,
			rfp_id: Option<RfpId>,
		) -> DispatchResult {
			let proposer = ensure_signed(origin)?;
			ensure!(Vendors::<T>::contains_key(&vendor), Error::<T>::VendorNotRegistered);
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);
			ensure!(amount <= T::MaxProposalAmount::get(), Error::<T>::AmountExceedsMax);

			if let Some(id) = rfp_id {
				let rfp = Rfps::<T>::get(id).ok_or(Error::<T>::RfpNotFound)?;
				ensure!(rfp.status == RfpStatus::Open, Error::<T>::RfpNotOpen);
				ensure!(amount <= rfp.max_amount, Error::<T>::RfpAmountExceeded);
				ensure!(ward == rfp.ward, Error::<T>::WardMismatch);
			}

			let id = ProposalCount::<T>::get();
			let now = frame_system::Pallet::<T>::block_number();

			Proposals::<T>::insert(
				id,
				Proposal {
					proposer: proposer.clone(),
					vendor: vendor.clone(),
					title,
					description,
					amount,
					status: ProposalStatus::PendingReview,
					ayes: 0,
					nays: 0,
					created_at: now,
					// Not meaningful until vetted; `vet_proposal` sets the real voting deadline.
					voting_end: now,
					ward,
					rfp_id,
				},
			);
			ProposalCount::<T>::put(id.saturating_add(1));

			Self::deposit_event(Event::ProposalSubmitted { id, proposer, vendor, amount });
			Ok(())
		}

		/// Vet a pending proposal: approve it to open for public voting, or veto it outright.
		/// Restricted to [`Config::AdminOrigin`] - the quality gate citizens rely on before a
		/// proposal is worth their attention and a vote.
		#[pallet::call_index(13)]
		#[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
		pub fn vet_proposal(origin: OriginFor<T>, id: ProposalId, approve: bool) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;
			let now = frame_system::Pallet::<T>::block_number();

			let voting_end = Proposals::<T>::try_mutate(id, |maybe_proposal| -> Result<BlockNumberFor<T>, DispatchError> {
				let proposal = maybe_proposal.as_mut().ok_or(Error::<T>::ProposalNotFound)?;
				ensure!(proposal.status == ProposalStatus::PendingReview, Error::<T>::ProposalNotPendingReview);
				if approve {
					proposal.status = ProposalStatus::Proposed;
					proposal.voting_end = now.saturating_add(T::VotingPeriod::get());
				} else {
					proposal.status = ProposalStatus::Vetoed;
				}
				Ok(proposal.voting_end)
			})?;

			if approve {
				Self::deposit_event(Event::ProposalVetted { id, voting_end });
			} else {
				Self::deposit_event(Event::ProposalVetoed { id });
			}
			Ok(())
		}

		/// Cast a vote on an open proposal. One account may vote once per proposal. If the
		/// proposal is scoped to a ward (not `Citywide`), only a verified resident of that same
		/// ward may vote.
		#[pallet::call_index(3)]
		#[pallet::weight(T::DbWeight::get().reads_writes(3, 2))]
		pub fn vote(origin: OriginFor<T>, id: ProposalId, approve: bool) -> DispatchResult {
			let voter = ensure_signed(origin)?;
			ensure!(VoteOf::<T>::get(id, &voter).is_none(), Error::<T>::AlreadyVoted);

			let (ayes, nays) = Proposals::<T>::try_mutate(id, |maybe_proposal| -> Result<(u32, u32), DispatchError> {
				let proposal = maybe_proposal.as_mut().ok_or(Error::<T>::ProposalNotFound)?;
				ensure!(proposal.status == ProposalStatus::Proposed, Error::<T>::ProposalNotOpen);
				let now = frame_system::Pallet::<T>::block_number();
				ensure!(now <= proposal.voting_end, Error::<T>::VotingPeriodEnded);

				if proposal.ward != Ward::Citywide {
					let record = KycRecords::<T>::get(&voter).ok_or(Error::<T>::NotResidentOfWard)?;
					ensure!(record.status == KycStatus::Verified, Error::<T>::NotResidentOfWard);
					ensure!(record.ward == proposal.ward, Error::<T>::NotResidentOfWard);
					if let Some(expires_at) = record.expires_at {
						ensure!(now <= expires_at, Error::<T>::KycExpired);
					}
				}

				if approve {
					proposal.ayes = proposal.ayes.saturating_add(1);
				} else {
					proposal.nays = proposal.nays.saturating_add(1);
				}
				Ok((proposal.ayes, proposal.nays))
			})?;

			VoteOf::<T>::insert(id, &voter, approve);
			Self::deposit_event(Event::VoteCast { id, voter, approve, ayes, nays });
			Ok(())
		}

		/// Tally a proposal once its voting period has ended. Callable by anyone.
		#[pallet::call_index(4)]
		#[pallet::weight(T::DbWeight::get().reads_writes(3, 3))]
		pub fn close_proposal(origin: OriginFor<T>, id: ProposalId) -> DispatchResult {
			ensure_signed(origin)?;

			let mut proposal = Proposals::<T>::get(id).ok_or(Error::<T>::ProposalNotFound)?;
			ensure!(proposal.status == ProposalStatus::Proposed, Error::<T>::ProposalNotOpen);
			let now = frame_system::Pallet::<T>::block_number();
			ensure!(now > proposal.voting_end, Error::<T>::VotingPeriodNotEnded);

			let total_votes = proposal.ayes.saturating_add(proposal.nays);
			let passed = total_votes >= T::MinimumQuorum::get() && proposal.ayes > proposal.nays;

			if passed {
				proposal.status = ProposalStatus::Approved;
				Proposals::<T>::insert(id, proposal.clone());
				Self::deposit_event(Event::ProposalApproved { id, ayes: proposal.ayes, nays: proposal.nays });
				Self::try_disburse(id)?;
			} else {
				proposal.status = ProposalStatus::Rejected;
				Self::deposit_event(Event::ProposalRejected { id, ayes: proposal.ayes, nays: proposal.nays });
				Proposals::<T>::insert(id, proposal);
			}
			Ok(())
		}

		/// Retry disbursement of a proposal that was approved but not yet funded.
		#[pallet::call_index(5)]
		#[pallet::weight(T::DbWeight::get().reads_writes(2, 2))]
		pub fn disburse(origin: OriginFor<T>, id: ProposalId) -> DispatchResult {
			ensure_signed(origin)?;
			let proposal = Proposals::<T>::get(id).ok_or(Error::<T>::ProposalNotFound)?;
			ensure!(proposal.status == ProposalStatus::Approved, Error::<T>::ProposalNotApproved);
			Self::try_disburse(id)
		}

		/// Withdraw a proposal. Only the original proposer may cancel, and only before voting closes.
		#[pallet::call_index(6)]
		#[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
		pub fn cancel_proposal(origin: OriginFor<T>, id: ProposalId) -> DispatchResult {
			let who = ensure_signed(origin)?;
			Proposals::<T>::try_mutate(id, |maybe_proposal| -> DispatchResult {
				let proposal = maybe_proposal.as_mut().ok_or(Error::<T>::ProposalNotFound)?;
				ensure!(proposal.proposer == who, Error::<T>::NotProposer);
				ensure!(
					proposal.status == ProposalStatus::PendingReview || proposal.status == ProposalStatus::Proposed,
					Error::<T>::ProposalNotOpen
				);
				proposal.status = ProposalStatus::Cancelled;
				Ok(())
			})?;

			Self::deposit_event(Event::ProposalCancelled { id });
			Ok(())
		}

		/// Contribute funds to the public, transparent treasury pot.
		#[pallet::call_index(7)]
		#[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
		pub fn fund_treasury(origin: OriginFor<T>, amount: BalanceOf<T>) -> DispatchResult {
			let from = ensure_signed(origin)?;
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);

			let pot = Self::treasury_account_id();
			T::NativeBalance::transfer(&from, &pot, amount, Preservation::Expendable)?;

			TotalFundsReceived::<T>::mutate(|total| *total = total.saturating_add(amount));
			let pot_balance = T::NativeBalance::balance(&pot);

			Self::deposit_event(Event::TreasuryFunded { from, amount, pot_balance });
			Ok(())
		}

		/// Post a public progress update. Only a registered vendor may post to their own feed.
		#[pallet::call_index(9)]
		#[pallet::weight(T::DbWeight::get().reads_writes(2, 2))]
		pub fn post_vendor_update(
			origin: OriginFor<T>,
			content: BoundedVec<u8, T::MaxUpdateContentLen>,
			proposal_id: Option<ProposalId>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(Vendors::<T>::contains_key(&who), Error::<T>::VendorNotRegistered);

			if let Some(id) = proposal_id {
				let proposal = Proposals::<T>::get(id).ok_or(Error::<T>::ProposalNotFound)?;
				ensure!(proposal.vendor == who, Error::<T>::NotProposalVendor);
			}

			let update_id = VendorUpdateCount::<T>::get(&who);
			VendorUpdates::<T>::insert(
				&who,
				update_id,
				VendorUpdate {
					vendor: who.clone(),
					content,
					proposal_id,
					posted_at: frame_system::Pallet::<T>::block_number(),
				},
			);
			VendorUpdateCount::<T>::insert(&who, update_id.saturating_add(1));

			Self::deposit_event(Event::VendorUpdatePosted { vendor: who, id: update_id, proposal_id });
			Ok(())
		}

		/// Register the caller as a donor eligible to submit named grants.
		#[pallet::call_index(10)]
		#[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
		pub fn register_donor(
			origin: OriginFor<T>,
			name: BoundedVec<u8, T::MaxDonorNameLen>,
			donor_type: DonorType,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(!Donors::<T>::contains_key(&who), Error::<T>::DonorAlreadyRegistered);

			Donors::<T>::insert(
				&who,
				DonorInfo {
					name: name.clone(),
					donor_type,
					registered_at: frame_system::Pallet::<T>::block_number(),
					total_contributed: Zero::zero(),
					grants_made: 0,
				},
			);

			Self::deposit_event(Event::DonorRegistered { who, name, donor_type });
			Ok(())
		}

		/// Submit a named, purpose-labeled grant to the public treasury. Only a registered donor
		/// may submit a grant; unlike [`Pallet::fund_treasury`], this is recorded in the public
		/// grants registry against the donor's own profile.
		#[pallet::call_index(11)]
		#[pallet::weight(T::DbWeight::get().reads_writes(2, 2))]
		pub fn submit_grant(
			origin: OriginFor<T>,
			amount: BalanceOf<T>,
			purpose: BoundedVec<u8, T::MaxGrantPurposeLen>,
		) -> DispatchResult {
			let donor = ensure_signed(origin)?;
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);
			ensure!(Donors::<T>::contains_key(&donor), Error::<T>::DonorNotRegistered);

			let pot = Self::treasury_account_id();
			T::NativeBalance::transfer(&donor, &pot, amount, Preservation::Expendable)?;
			TotalFundsReceived::<T>::mutate(|total| *total = total.saturating_add(amount));

			let id = GrantCount::<T>::get();
			Grants::<T>::insert(
				id,
				Grant {
					donor: donor.clone(),
					amount,
					purpose,
					submitted_at: frame_system::Pallet::<T>::block_number(),
				},
			);
			GrantCount::<T>::put(id.saturating_add(1));
			Donors::<T>::mutate(&donor, |maybe_donor| {
				if let Some(info) = maybe_donor {
					info.total_contributed = info.total_contributed.saturating_add(amount);
					info.grants_made = info.grants_made.saturating_add(1);
				}
			});

			Self::deposit_event(Event::GrantSubmitted { id, donor, amount });
			Ok(())
		}

		/// Mint newly-staked tokens for `who`, e.g. after a payment-gateway backend (Stripe) has
		/// confirmed an off-chain fiat payment. Restricted to [`Config::PaymentGatewayOrigin`].
		#[pallet::call_index(12)]
		#[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
		pub fn stake_mint(origin: OriginFor<T>, who: T::AccountId, amount: BalanceOf<T>) -> DispatchResult {
			T::PaymentGatewayOrigin::ensure_origin(origin)?;
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);

			T::NativeBalance::mint_into(&who, amount)?;

			Self::deposit_event(Event::TokensStaked { who, amount });
			Ok(())
		}

		/// Post a new request for proposals: a defined civic need, scoped to a ward, that
		/// vendors may respond to with a funding proposal. Restricted to [`Config::AdminOrigin`].
		#[pallet::call_index(14)]
		#[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
		pub fn post_rfp(
			origin: OriginFor<T>,
			title: BoundedVec<u8, T::MaxTitleLen>,
			description: BoundedVec<u8, T::MaxDescriptionLen>,
			ward: Ward,
			max_amount: BalanceOf<T>,
		) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;
			ensure!(!max_amount.is_zero(), Error::<T>::ZeroAmount);

			let id = RfpCount::<T>::get();
			let now = frame_system::Pallet::<T>::block_number();
			Rfps::<T>::insert(
				id,
				Rfp { title, description, ward, max_amount, status: RfpStatus::Open, created_at: now },
			);
			RfpCount::<T>::put(id.saturating_add(1));

			Self::deposit_event(Event::RfpPosted { id, ward, max_amount });
			Ok(())
		}

		/// Close an RFP to new proposal responses. Restricted to [`Config::AdminOrigin`].
		#[pallet::call_index(15)]
		#[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
		pub fn close_rfp(origin: OriginFor<T>, id: RfpId) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;

			Rfps::<T>::try_mutate(id, |maybe_rfp| -> DispatchResult {
				let rfp = maybe_rfp.as_mut().ok_or(Error::<T>::RfpNotFound)?;
				rfp.status = RfpStatus::Closed;
				Ok(())
			})?;

			Self::deposit_event(Event::RfpClosed { id });
			Ok(())
		}

		/// Submit (or resubmit) an identity-verification (KYC) request: a declared ward, ID
		/// document type, and a client-computed hash of the applicant's full name, date of
		/// birth, and document number. VendorDAO never receives or stores the underlying
		/// personal data - only this one-way hash. Starts `Pending`; an admin must
		/// [`Pallet::set_kyc_status`] it before the declared ward is usable to vote on
		/// ward-scoped proposals.
		#[pallet::call_index(16)]
		#[pallet::weight(T::DbWeight::get().reads_writes(0, 1))]
		pub fn submit_kyc(
			origin: OriginFor<T>,
			ward: Ward,
			document_type: DocumentType,
			document_hash: [u8; 32],
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			KycRecords::<T>::insert(
				&who,
				KycRecord {
					ward,
					document_type,
					document_hash,
					status: KycStatus::Pending,
					submitted_at: frame_system::Pallet::<T>::block_number(),
					verified_at: None,
					expires_at: None,
					rejection_reason: None,
				},
			);

			Self::deposit_event(Event::KycSubmitted { who, ward });
			Ok(())
		}

		/// Approve or reject a pending KYC request. Restricted to [`Config::AdminOrigin`].
		/// Approving locks the declared ward and starts a [`Config::KycValidityPeriod`]-block
		/// expiry, after which the resident must re-verify to keep voting on ward-scoped
		/// proposals. Rejecting may include a stated `reason` shown to the applicant.
		#[pallet::call_index(17)]
		#[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
		pub fn set_kyc_status(
			origin: OriginFor<T>,
			who: T::AccountId,
			approve: bool,
			reason: Option<BoundedVec<u8, T::MaxRejectionReasonLen>>,
		) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;
			let now = frame_system::Pallet::<T>::block_number();

			let (ward, expires_at) = KycRecords::<T>::try_mutate(
				&who,
				|maybe_record| -> Result<(Ward, Option<BlockNumberFor<T>>), DispatchError> {
					let record = maybe_record.as_mut().ok_or(Error::<T>::KycRecordNotFound)?;
					ensure!(record.status == KycStatus::Pending, Error::<T>::KycNotPending);
					if approve {
						record.status = KycStatus::Verified;
						record.verified_at = Some(now);
						record.expires_at = Some(now.saturating_add(T::KycValidityPeriod::get()));
						record.rejection_reason = None;
					} else {
						record.status = KycStatus::Rejected;
						record.verified_at = None;
						record.expires_at = None;
						record.rejection_reason = reason.clone();
					}
					Ok((record.ward, record.expires_at))
				},
			)?;

			if approve {
				Self::deposit_event(Event::KycVerified { who, ward, expires_at: expires_at.unwrap_or(now) });
			} else {
				Self::deposit_event(Event::KycRejected { who, reason });
			}
			Ok(())
		}

		/// Post an itemized receipt recording how part of a funded proposal's disbursed funds
		/// were spent. Only that proposal's own vendor may post, and the running total of
		/// receipts for a proposal can never exceed the amount actually disbursed to it.
		#[pallet::call_index(18)]
		#[pallet::weight(T::DbWeight::get().reads_writes(2, 2))]
		pub fn post_spending_receipt(
			origin: OriginFor<T>,
			proposal_id: ProposalId,
			amount: BalanceOf<T>,
			category: BoundedVec<u8, T::MaxReceiptCategoryLen>,
			description: BoundedVec<u8, T::MaxReceiptDescriptionLen>,
			attachment_hash: Option<[u8; 32]>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(amount > Zero::zero(), Error::<T>::ZeroAmount);

			let proposal = Proposals::<T>::get(proposal_id).ok_or(Error::<T>::ProposalNotFound)?;
			ensure!(proposal.vendor == who, Error::<T>::NotProposalVendor);
			ensure!(proposal.status == ProposalStatus::Funded, Error::<T>::ProposalNotFunded);

			let already_receipted: BalanceOf<T> = SpendingReceipts::<T>::iter_prefix_values(proposal_id)
				.fold(Zero::zero(), |total: BalanceOf<T>, receipt| total.saturating_add(receipt.amount));
			ensure!(
				already_receipted.saturating_add(amount) <= proposal.amount,
				Error::<T>::ReceiptExceedsDisbursedAmount
			);

			let receipt_id = SpendingReceiptCount::<T>::get(proposal_id);
			SpendingReceipts::<T>::insert(
				proposal_id,
				receipt_id,
				SpendingReceipt {
					proposal_id,
					vendor: who.clone(),
					amount,
					category,
					description,
					attachment_hash,
					posted_at: frame_system::Pallet::<T>::block_number(),
				},
			);
			SpendingReceiptCount::<T>::insert(proposal_id, receipt_id.saturating_add(1));

			Self::deposit_event(Event::SpendingReceiptPosted { proposal_id, id: receipt_id, vendor: who, amount });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// The sovereign account that holds the public treasury ("ledger of funds").
		pub fn treasury_account_id() -> T::AccountId {
			T::TreasuryPalletId::get().into_account_truncating()
		}

		/// The treasury pot's current, live balance.
		pub fn treasury_balance() -> BalanceOf<T> {
			T::NativeBalance::balance(&Self::treasury_account_id())
		}

		/// Attempt to pay an approved proposal's vendor from the treasury pot.
		fn try_disburse(id: ProposalId) -> DispatchResult {
			Proposals::<T>::try_mutate(id, |maybe_proposal| -> DispatchResult {
				let proposal = maybe_proposal.as_mut().ok_or(Error::<T>::ProposalNotFound)?;
				ensure!(proposal.status == ProposalStatus::Approved, Error::<T>::ProposalNotApproved);

				let pot = Self::treasury_account_id();
				match T::NativeBalance::transfer(&pot, &proposal.vendor, proposal.amount, Preservation::Expendable) {
					Ok(_) => {
						proposal.status = ProposalStatus::Funded;
						TotalFundsDisbursed::<T>::mutate(|total| *total = total.saturating_add(proposal.amount));
						Vendors::<T>::mutate(&proposal.vendor, |maybe_vendor| {
							if let Some(vendor) = maybe_vendor {
								vendor.total_received = vendor.total_received.saturating_add(proposal.amount);
								vendor.proposals_funded = vendor.proposals_funded.saturating_add(1);
							}
						});
						Self::deposit_event(Event::ProposalFunded {
							id,
							vendor: proposal.vendor.clone(),
							amount: proposal.amount,
						});
						Ok(())
					},
					// Not a hard failure: the proposal stays `Approved` so `disburse` can retry
					// once the treasury has received enough additional contributions.
					Err(_) => {
						Self::deposit_event(Event::DisbursementPending { id, amount: proposal.amount });
						Ok(())
					},
				}
			})
		}
	}
}
