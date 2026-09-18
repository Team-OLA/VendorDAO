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

	/// The lifecycle status of a funding proposal.
	#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo)]
	pub enum ProposalStatus {
		/// Open for voting.
		Proposed,
		/// Passed quorum + majority, awaiting or pending disbursement.
		Approved,
		/// Did not reach quorum or majority.
		Rejected,
		/// Approved and successfully paid out to the vendor.
		Funded,
		/// Withdrawn by its proposer before voting closed.
		Cancelled,
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

	/// Lifetime total of funds ever contributed to the public treasury.
	#[pallet::storage]
	pub type TotalFundsReceived<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// Lifetime total of funds ever disbursed to vendors.
	#[pallet::storage]
	pub type TotalFundsDisbursed<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

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
		/// A new proposal was submitted and opened for voting.
		ProposalSubmitted {
			id: ProposalId,
			proposer: T::AccountId,
			vendor: T::AccountId,
			amount: BalanceOf<T>,
			voting_end: BlockNumberFor<T>,
		},
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

		/// Submit a new funding proposal on behalf of a registered vendor.
		#[pallet::call_index(2)]
		#[pallet::weight(T::DbWeight::get().reads_writes(2, 2))]
		pub fn submit_proposal(
			origin: OriginFor<T>,
			vendor: T::AccountId,
			title: BoundedVec<u8, T::MaxTitleLen>,
			description: BoundedVec<u8, T::MaxDescriptionLen>,
			amount: BalanceOf<T>,
		) -> DispatchResult {
			let proposer = ensure_signed(origin)?;
			ensure!(Vendors::<T>::contains_key(&vendor), Error::<T>::VendorNotRegistered);
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);
			ensure!(amount <= T::MaxProposalAmount::get(), Error::<T>::AmountExceedsMax);

			let id = ProposalCount::<T>::get();
			let now = frame_system::Pallet::<T>::block_number();
			let voting_end = now.saturating_add(T::VotingPeriod::get());

			Proposals::<T>::insert(
				id,
				Proposal {
					proposer: proposer.clone(),
					vendor: vendor.clone(),
					title,
					description,
					amount,
					status: ProposalStatus::Proposed,
					ayes: 0,
					nays: 0,
					created_at: now,
					voting_end,
				},
			);
			ProposalCount::<T>::put(id.saturating_add(1));

			Self::deposit_event(Event::ProposalSubmitted { id, proposer, vendor, amount, voting_end });
			Ok(())
		}

		/// Cast a vote on an open proposal. One account may vote once per proposal.
		#[pallet::call_index(3)]
		#[pallet::weight(T::DbWeight::get().reads_writes(2, 2))]
		pub fn vote(origin: OriginFor<T>, id: ProposalId, approve: bool) -> DispatchResult {
			let voter = ensure_signed(origin)?;
			ensure!(VoteOf::<T>::get(id, &voter).is_none(), Error::<T>::AlreadyVoted);

			let (ayes, nays) = Proposals::<T>::try_mutate(id, |maybe_proposal| -> Result<(u32, u32), DispatchError> {
				let proposal = maybe_proposal.as_mut().ok_or(Error::<T>::ProposalNotFound)?;
				ensure!(proposal.status == ProposalStatus::Proposed, Error::<T>::ProposalNotOpen);
				let now = frame_system::Pallet::<T>::block_number();
				ensure!(now <= proposal.voting_end, Error::<T>::VotingPeriodEnded);

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
				ensure!(proposal.status == ProposalStatus::Proposed, Error::<T>::ProposalNotOpen);
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
