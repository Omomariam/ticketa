// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract Ticketa is ERC721Enumerable, ReentrancyGuard, EIP712 {
    struct EventDetails { string name; string venue; string description; string category; string imageUrl; uint64 startsAt; uint64 endsAt; }
    struct EventInfo { uint256 id; address organizer; EventDetails details; uint256 proceeds; uint256 sold; uint256 checkedIn; }
    struct TierInput { string name; uint256 price; uint256 capacity; }
    struct Tier { string name; uint256 price; uint256 capacity; uint256 minted; }
    struct EventView { EventInfo info; Tier[] tiers; }
    struct TicketInfo { uint256 eventId; uint256 tierId; bool used; uint256 nonce; }
    struct TicketView { uint256 id; address owner; TicketInfo info; }
    bytes32 private constant CHECK_IN_TYPEHASH = keccak256("CheckIn(uint256 ticketId,uint256 nonce,uint256 deadline)");
    uint256 public eventCount;
    uint256 public ticketCount;
    mapping(uint256 => EventInfo) private eventData;
    mapping(uint256 => Tier[]) private eventTiers;
    mapping(uint256 => TicketInfo) public ticketInfo;
    mapping(uint256 => mapping(address => bool)) public checkInStaff;
    event EventCreated(uint256 indexed eventId, address indexed organizer, string name);
    event EventUpdated(uint256 indexed eventId);
    event TicketPurchased(uint256 indexed tokenId, uint256 indexed eventId, address indexed buyer, uint256 tierId);
    event CheckedIn(uint256 indexed tokenId, uint256 indexed eventId, address indexed owner);
    event StaffUpdated(uint256 indexed eventId, address indexed staff, bool authorized);
    event ProceedsWithdrawn(uint256 indexed eventId, address indexed organizer, uint256 amount);
    constructor() ERC721("Ticketa", "TKT") EIP712("Ticketa", "1") {}

    function _validateDetails(EventDetails calldata details) private view {
        require(bytes(details.name).length > 0 && bytes(details.name).length <= 80, "Invalid event name");
        require(bytes(details.venue).length > 0 && bytes(details.venue).length <= 160, "Invalid venue");
        require(bytes(details.description).length <= 2000 && bytes(details.category).length <= 40 && bytes(details.imageUrl).length <= 512, "Details too long");
        require(details.startsAt > block.timestamp && details.endsAt > details.startsAt, "Invalid event dates");
    }
    function createEvent(EventDetails calldata details, TierInput[] calldata tiers) external returns (uint256 id) {
        _validateDetails(details);
        require(tiers.length > 0 && tiers.length <= 20, "Invalid tiers");
        id = ++eventCount;
        eventData[id] = EventInfo(id, msg.sender, details, 0, 0, 0);
        for (uint256 i; i < tiers.length; ++i) {
            require(bytes(tiers[i].name).length > 0 && bytes(tiers[i].name).length <= 80 && tiers[i].capacity > 0, "Invalid tier");
            eventTiers[id].push(Tier(tiers[i].name, tiers[i].price, tiers[i].capacity, 0));
        }
        emit EventCreated(id, msg.sender, details.name);
    }
    /// @notice Metadata can be corrected before the event starts. Dates and tier terms remain fixed.
    function updateEvent(uint256 id, string calldata name, string calldata venue, string calldata description, string calldata category, string calldata imageUrl) external {
        EventInfo storage info = eventData[id];
        require(info.organizer == msg.sender, "Organizer only");
        require(block.timestamp < info.details.startsAt, "Event has started");
        require(bytes(name).length > 0 && bytes(name).length <= 80 && bytes(venue).length > 0 && bytes(venue).length <= 160, "Invalid event details");
        require(bytes(description).length <= 2000 && bytes(category).length <= 40 && bytes(imageUrl).length <= 512, "Details too long");
        info.details.name=name; info.details.venue=venue; info.details.description=description; info.details.category=category; info.details.imageUrl=imageUrl;
        emit EventUpdated(id);
    }
    function getEvent(uint256 id) public view returns (EventView memory) {
        require(eventData[id].organizer != address(0), "Event not found");
        return EventView(eventData[id], eventTiers[id]);
    }
    function getEvents(uint256 firstId, uint256 limit) external view returns (EventView[] memory list) {
        require(firstId > 0 && limit <= 25, "Invalid page");
        uint256 length = firstId > eventCount ? 0 : eventCount - firstId + 1;
        if(length > limit) length=limit;
        list=new EventView[](length);
        for(uint256 i; i<length; ++i) list[i]=getEvent(firstId+i);
    }
    function getOwnedTickets(address owner, uint256 offset, uint256 limit) external view returns (TicketView[] memory list) {
        require(limit <= 100, "Invalid page");
        uint256 total=balanceOf(owner);
        uint256 length=offset >= total ? 0 : total-offset;
        if(length > limit) length=limit;
        list=new TicketView[](length);
        for(uint256 i; i<length; ++i) {
            uint256 id=tokenOfOwnerByIndex(owner,offset+i);
            list[i]=TicketView(id,owner,ticketInfo[id]);
        }
    }
    function purchase(uint256 eventId, uint256 tierId) external payable nonReentrant returns (uint256 tokenId) {
        EventInfo storage info=eventData[eventId];
        require(info.organizer != address(0) && block.timestamp < info.details.startsAt, "Sales closed");
        require(tierId < eventTiers[eventId].length, "Unknown tier");
        Tier storage tier=eventTiers[eventId][tierId];
        require(msg.value == tier.price, "Incorrect payment");
        require(tier.minted < tier.capacity, "Sold out");
        ++tier.minted; ++info.sold; info.proceeds+=msg.value;
        tokenId=++ticketCount;
        ticketInfo[tokenId]=TicketInfo(eventId,tierId,false,0);
        _safeMint(msg.sender,tokenId);
        emit TicketPurchased(tokenId,eventId,msg.sender,tierId);
    }
    function setCheckInStaff(uint256 eventId, address staff, bool authorized) external {
        require(eventData[eventId].organizer == msg.sender, "Organizer only");
        require(staff != address(0), "Invalid staff");
        checkInStaff[eventId][staff]=authorized;
        emit StaffUpdated(eventId,staff,authorized);
    }
    function proofIsValid(uint256 ticketId, uint256 nonce, uint256 deadline, bytes calldata signature) public view returns (bool) {
        address owner=ownerOf(ticketId);
        TicketInfo storage ticket=ticketInfo[ticketId];
        if(ticket.used || nonce != ticket.nonce || deadline < block.timestamp || deadline > block.timestamp+600) return false;
        bytes32 digest=_hashTypedDataV4(keccak256(abi.encode(CHECK_IN_TYPEHASH,ticketId,nonce,deadline)));
        return SignatureChecker.isValidSignatureNow(owner,digest,signature);
    }
    /// @notice Current owners sign short-lived EIP-712 QR proofs. Authorized staff submit check-in.
    function checkIn(uint256 ticketId, uint256 nonce, uint256 deadline, bytes calldata signature) external {
        TicketInfo storage ticket=ticketInfo[ticketId];
        EventInfo storage info=eventData[ticket.eventId];
        require(msg.sender == info.organizer || checkInStaff[ticket.eventId][msg.sender], "Unauthorized");
        require(block.timestamp >= info.details.startsAt && block.timestamp <= info.details.endsAt, "Outside event window");
        require(!ticket.used, "Ticket already used");
        require(proofIsValid(ticketId,nonce,deadline,signature), "Invalid or expired proof");
        ticket.used=true; ++info.checkedIn;
        emit CheckedIn(ticketId,ticket.eventId,ownerOf(ticketId));
    }
    function withdraw(uint256 eventId) external nonReentrant {
        EventInfo storage info=eventData[eventId];
        require(msg.sender == info.organizer, "Organizer only");
        uint256 amount=info.proceeds;
        require(amount > 0, "No proceeds");
        info.proceeds=0;
        (bool success,)=payable(msg.sender).call{value:amount}("");
        require(success, "Withdrawal failed");
        emit ProceedsWithdrawn(eventId,msg.sender,amount);
    }
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory id=Strings.toString(tokenId);
        string memory svg=string.concat('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360"><rect width="600" height="360" rx="24" fill="#0C1222"/><text x="40" y="70" fill="#38BDF8" font-family="sans-serif" font-size="36">ticketa.</text><text x="40" y="175" fill="white" font-family="sans-serif" font-size="48">Ticket #',id,'</text><text x="40" y="235" fill="#F97316" font-family="sans-serif" font-size="22">Your ticket. Your wallet. Your proof.</text><text x="40" y="305" fill="#38BDF8" font-family="sans-serif" font-size="18">BOT Chain</text></svg>');
        return string.concat('data:application/json;base64,',Base64.encode(bytes(string.concat('{"name":"Ticketa Ticket #',id,'","description":"Wallet-owned event ticket on BOT Chain.","image":"data:image/svg+xml;base64,',Base64.encode(bytes(svg)),'","attributes":[{"trait_type":"Event","value":"',Strings.toString(ticketInfo[tokenId].eventId),'"},{"trait_type":"Used","value":"',ticketInfo[tokenId].used?'Yes':'No','"}]}'))));
    }
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        require(!ticketInfo[tokenId].used, "Used tickets cannot move");
        from=super._update(to,tokenId,auth);
        if(from != address(0)) ++ticketInfo[tokenId].nonce;
    }
}
