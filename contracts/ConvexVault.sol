// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Importing necessary contracts and libraries
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IBooster.sol";
import "hardhat/console.sol";

// Interface for the base reward pool
interface IBaseRewardPool {
    function withdraw(uint256 amount, bool claim) external returns (bool);

    function withdrawAll(bool claim) external;

    function withdrawAndUnwrap(
        uint256 amount,
        bool claim
    ) external returns (bool);

    function withdrawAllAndUnwrap(bool claim) external;

    function stakingToken() external returns (IERC20);
    function earned(address account) external view returns (uint256);

    function getReward(
        address _account,
        bool _claimExtras
    ) external returns (bool);
}

interface IConvexToken is IERC20{
    function maxSupply() external view returns (uint256);
    function totalCliffs() external view returns (uint256);
    function reductionPerCliff() external view returns (uint256);
}

// ConvexVault contract, inheriting from Ownable
contract ConvexVault is Ownable {
    using SafeMath for uint256;

    // Struct to store reward indices
    struct RewardIndex {
        uint256 cvxIndex; // CVX Reward Index
        uint256 crvIndex; // CRV Reward Index
    }

    // Struct to store rewards
    struct Reward {
        uint256 cvxEarned; 
        uint256 crvEarned;
    }

    // Struct to store user information
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        Reward reward; 
        RewardIndex rewardIndex;
    }

    // Struct to store pool information
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 convexPid;
        uint256 allocPoint; // How many allocation points assigned to this pool. 
        uint256 totalSupply; 
    }

    // Constants and contract instances
    IBooster public constant CvxBooster = IBooster(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    IConvexToken public constant CvxToken = IConvexToken(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    IERC20 public constant CrvToken = IERC20(0xD533a949740bb3306d119CC777fa900bA034cd52);
    uint private constant MULTIPLIER = 1e18;

    // Arrays and mappings to store pool and user information
    PoolInfo[] public poolInfo;
    uint256 public totalAllocPoint = 0;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(uint256 => RewardIndex) public rewardIndex;

    // Event emitted on deposit
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    // Event emitted on withdrawal
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);

    // Event emitted on reward payment
    event RewardPaid(
        address indexed user,
        uint256 indexed pid,
        uint256 crvReward,
        uint256 cvxReward
    );

    // Function to get the number of pools
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Function to get information about a Convex pool
    function getConvexPoolInfo(
        uint256 _pid
    ) public view returns (IBooster.PoolInfo memory) {
        return CvxBooster.poolInfo(poolInfo[_pid].convexPid);
    }

    // Function to add a new pool
    function addPool(
        uint256 _allocPoint,
        address _lpToken,
        uint256 _pid
    ) public onlyOwner {
        IBooster.PoolInfo memory cvxPoolInfo = CvxBooster.poolInfo(_pid);
        require(_lpToken == cvxPoolInfo.lptoken, "Wrong Pid for Convex");
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                lpToken: IERC20(_lpToken),
                convexPid: _pid,
                allocPoint: _allocPoint,
                totalSupply: 0
            })
        );
    }

    // Function to get rewards from Convex and update reward indices
    function getVaultRewards(uint256 _pid) public {
        uint256 crvBalance = CrvToken.balanceOf(address(this));
        uint256 cvxBalance = CvxToken.balanceOf(address(this));
        IBooster.PoolInfo memory convexPool = getConvexPoolInfo(_pid);
        IBaseRewardPool(convexPool.crvRewards).getReward(address(this), true);

        uint256 updatedCrvBalance = CrvToken.balanceOf(address(this));
        uint256 updatedCvxBalance = CvxToken.balanceOf(address(this));

        if (updatedCrvBalance > crvBalance && poolInfo[_pid].totalSupply > 0) {
            rewardIndex[_pid].crvIndex += ((updatedCrvBalance - crvBalance) * MULTIPLIER) / poolInfo[_pid].totalSupply;
        }
        if (updatedCvxBalance > cvxBalance && poolInfo[_pid].totalSupply > 0) {
            rewardIndex[_pid].cvxIndex += ((updatedCvxBalance - cvxBalance) * MULTIPLIER) / poolInfo[_pid].totalSupply;
        }
    }

    // Function to get the total rewards earned by a user
    function calculateRewardsEarned(
        address _account,
        uint256 _pid
    ) external view returns (uint rewardCrv, uint rewardCvx) {
        IBooster.PoolInfo memory convexPool = getConvexPoolInfo(_pid);
        UserInfo memory info = userInfo[_pid][_account];
        uint256 pendingCrvReward = IBaseRewardPool(convexPool.crvRewards).earned(address(this));
        uint256 pendingCvxReward = getCvxRewardFromCrv(pendingCrvReward);
        if(poolInfo[_pid].totalSupply != 0) {
            uint256 newCvxIndex = rewardIndex[_pid].cvxIndex + (pendingCvxReward * MULTIPLIER) / poolInfo[_pid].totalSupply;
            uint256 newCrvIndex = rewardIndex[_pid].crvIndex + (pendingCrvReward * MULTIPLIER) / poolInfo[_pid].totalSupply;

            uint cvxReward = (info.amount * (newCvxIndex - info.rewardIndex.cvxIndex)) / MULTIPLIER;
            uint crvReward = (info.amount * (newCrvIndex - info.rewardIndex.crvIndex)) / MULTIPLIER;

            Reward memory rewardEarned = userInfo[_pid][_account].reward;

            rewardCrv = rewardEarned.crvEarned + crvReward;
            rewardCvx = rewardEarned.cvxEarned + cvxReward;
        }
    }

    function getCvxRewardFromCrv(uint256 _crvAmount) internal view returns (uint256){
        uint256 amount = 0;
        uint256 supply = CvxToken.totalSupply();
        uint256 reductionPerCliff = CvxToken.reductionPerCliff();
        uint256 totalCliffs = CvxToken.totalCliffs();
        uint256 cliff = supply.div(reductionPerCliff);
        uint256 maxSupply = CvxToken.maxSupply();
        if(cliff < totalCliffs){
            uint256 reduction = totalCliffs.sub(cliff);
            //reduce
            amount = _crvAmount.mul(reduction).div(totalCliffs);

            //supply cap check
            uint256 amtTillMax = maxSupply.sub(supply);
            if(amount > amtTillMax){
                amount = amtTillMax;
            }
        }
        return amount;
    }

    // Function to update user rewards
    modifier _updateRewards(address _account, uint256 _pid) {
        getVaultRewards(_pid);
        UserInfo storage info = userInfo[_pid][_account];
        uint cvxReward = (info.amount * (rewardIndex[_pid].cvxIndex - info.rewardIndex.cvxIndex)) / MULTIPLIER;
        uint crvReward = (info.amount * (rewardIndex[_pid].crvIndex - info.rewardIndex.crvIndex)) / MULTIPLIER;
        info.reward.crvEarned += crvReward;
        info.reward.cvxEarned += cvxReward;
        info.rewardIndex = rewardIndex[_pid];
        _;
    }

    // Function to deposit LP tokens into ConvexVault
    function deposit(uint256 _pid, uint256 _amount) public _updateRewards(msg.sender, _pid){
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        pool.lpToken.transferFrom(address(msg.sender), address(this), _amount);

        user.amount = user.amount.add(_amount);
        pool.totalSupply = pool.totalSupply.add(_amount);

        uint balance = pool.lpToken.balanceOf(address(this));
        pool.lpToken.approve(address(CvxBooster), balance);
        CvxBooster.deposit(pool.convexPid, balance, true);

        emit Deposit(msg.sender, _pid, _amount);
    }

    // Function to withdraw LP tokens from ConvexVault
    function withdraw(uint256 _pid, uint256 _amount) public _updateRewards(msg.sender, _pid){
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        IBooster.PoolInfo memory convexPool = getConvexPoolInfo(_pid);
        require(user.amount >= _amount, "withdraw: not good");
        claim(_pid, msg.sender);

        IBaseRewardPool(convexPool.crvRewards).withdraw(_amount, true);
        CvxBooster.withdraw(pool.convexPid, _amount);

        user.amount = user.amount.sub(_amount);
        pool.totalSupply = pool.totalSupply.sub(_amount);
        pool.lpToken.transfer(address(msg.sender), _amount);

        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Function to claim rewards
    function claim(uint256 _pid, address _account) public _updateRewards(_account, _pid) {
        UserInfo storage user = userInfo[_pid][_account];
        uint256 cvxReward = user.reward.cvxEarned;
        uint256 crvReward = user.reward.crvEarned;
        if (cvxReward > 0) {
            user.reward.cvxEarned = 0;
            CvxToken.transfer(_account, cvxReward);
        }
        if (crvReward > 0) {
            user.reward.crvEarned = 0;
            CrvToken.transfer(_account, crvReward);
        }

        emit RewardPaid(_account, _pid, crvReward, cvxReward);
    }
}
