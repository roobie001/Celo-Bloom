// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract CeloBloom {
    uint256 public constant DAY = 1 days;
    uint256 public constant WEEK = 7 days;

    struct User {
        uint32 streakCount;
        uint64 lastWateredAt;
        uint32 growthLevel;
        uint32 totalActions;
        uint32 sunlightSent;
        uint32 sunlightReceived;
        uint64 lastClaimedWeek;
    }

    mapping(address => User) public users;
    address[] public participants;
    mapping(address => bool) public isParticipant;

    IERC20 public immutable cUSD;
    address public owner;
    uint256 public rewardAmount;

    event Watered(address indexed user, uint32 streakCount, uint32 growthLevel);
    event SunlightSent(address indexed from, address indexed to, uint32 fromGrowth, uint32 toGrowth);
    event RewardClaimed(address indexed user, uint256 amount, uint64 weekNumber);
    event RewardAmountUpdated(uint256 amount);
    event OwnerUpdated(address indexed owner);
    event StreakAdjusted(address indexed user, uint32 streak);
    event ParticipantRegistered(address indexed user);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _cUSD, uint256 _rewardAmount) {
        owner = msg.sender;
        cUSD = IERC20(_cUSD);
        rewardAmount = _rewardAmount;
        emit OwnerUpdated(owner);
    }

    function setRewardAmount(uint256 amount) external onlyOwner {
        rewardAmount = amount;
        emit RewardAmountUpdated(amount);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "BAD_OWNER");
        owner = nextOwner;
        emit OwnerUpdated(nextOwner);
    }

    function waterTree() external {
        _registerParticipant(msg.sender);

        User storage user = users[msg.sender];
        uint64 nowTs = uint64(block.timestamp);
        require(_isNewDay(user.lastWateredAt, nowTs), "ALREADY_WATERED");

        user.streakCount = _nextStreak(user.lastWateredAt, nowTs, user.streakCount);
        user.lastWateredAt = nowTs;
        user.totalActions += 1;
        user.growthLevel = _growthFor(user);

        emit Watered(msg.sender, user.streakCount, user.growthLevel);
    }

    function sendSunlight(address to) external {
        require(to != address(0) && to != msg.sender, "BAD_RECIPIENT");

        _registerParticipant(msg.sender);

        User storage sender = users[msg.sender];
        User storage recipient = users[to];

        sender.totalActions += 1;
        sender.sunlightSent += 1;
        recipient.sunlightReceived += 1;

        sender.growthLevel = _growthFor(sender);
        recipient.growthLevel = _growthFor(recipient);

        emit SunlightSent(msg.sender, to, sender.growthLevel, recipient.growthLevel);
    }

    function claimReward() external {
        _registerParticipant(msg.sender);

        User storage user = users[msg.sender];
        require(user.streakCount >= 3, "STREAK_TOO_LOW");

        uint64 weekNumber = uint64(block.timestamp / WEEK);
        require(user.lastClaimedWeek < weekNumber, "ALREADY_CLAIMED");

        user.lastClaimedWeek = weekNumber;
        user.totalActions += 1;
        user.growthLevel = _growthFor(user);

        require(cUSD.transfer(msg.sender, rewardAmount), "TRANSFER_FAILED");

        emit RewardClaimed(msg.sender, rewardAmount, weekNumber);
    }

    // TEST-ONLY: remove before mainnet deployment.
    function setStreakForTesting(address userAddress, uint256 streak) external onlyOwner {
        _registerParticipant(userAddress);
        users[userAddress].streakCount = uint32(streak);
        users[userAddress].growthLevel = _growthFor(users[userAddress]);
        emit StreakAdjusted(userAddress, uint32(streak));
    }

    function getParticipantCount() external view returns (uint256) {
        return participants.length;
    }

    function getParticipants(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory) {
        uint256 total = participants.length;
        if (offset >= total) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        address[] memory page = new address[](size);

        for (uint256 i = 0; i < size; i++) {
            page[i] = participants[offset + i];
        }

        return page;
    }

    function _isNewDay(uint64 lastWateredAt, uint64 nowTs) internal pure returns (bool) {
        if (lastWateredAt == 0) return true;
        return uint64(lastWateredAt / DAY) < uint64(nowTs / DAY);
    }

    function _nextStreak(
        uint64 lastWateredAt,
        uint64 nowTs,
        uint32 currentStreak
    ) internal pure returns (uint32) {
        if (lastWateredAt == 0) return 1;

        uint64 lastDay = uint64(lastWateredAt / DAY);
        uint64 today = uint64(nowTs / DAY);

        if (today == lastDay) return currentStreak;
        if (today == lastDay + 1) return currentStreak + 1;
        return 1;
    }

    function _growthFor(User storage user) internal view returns (uint32) {
        uint32 base;
        if (user.streakCount >= 14) {
            base = 4;
        } else if (user.streakCount >= 7) {
            base = 3;
        } else if (user.streakCount >= 3) {
            base = 2;
        } else {
            base = 1;
        }

        if (user.totalActions >= 20 && base < 4) {
            return base + 1;
        }
        return base;
    }

    function _registerParticipant(address userAddress) internal {
        if (isParticipant[userAddress]) return;

        isParticipant[userAddress] = true;
        participants.push(userAddress);
        emit ParticipantRegistered(userAddress);
    }
}
