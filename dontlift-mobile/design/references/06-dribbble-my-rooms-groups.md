# Reference 06: My Rooms (Groups) & In The Room — Home Page Designs

## Metadata
- **Source:** Dribbble
- **Link:** https://dribbble.com/shots/3349944-My-Rooms-Groups-In-The-Room-Home-Page-Designs
- **Date inspected:** 2026-09-14
- **Screenshot:** `screenshots/06-dribbble-my-rooms-groups.png`

## ⚠️ SCOPE: GROUP / ROOM UI ONLY

This reference is used **only for room list, room home page, and participant list UI study**, NOT for features outside DontLift scope.

DontLift does NOT include: group chat, messaging, social feed.

## Observations

### Colors
- Background: [note]
- Card fill: [note]
- Accent: [note]
- Text: [note]

### Layout
- Border radius: [note]px
- Padding: [note]px
- Room list: card-based
- Room home: participant list + header
- Font: SF UI Text

### Typography
- Font: SF UI Text
- Room name: [note]pt
- Participant name: [note]pt
- Status: [note]pt

### My Rooms (Groups) UI
- List of rooms/groups
- Room card with metadata
- Join/create button
- Room name + participant count

### In The Room UI
- Room header (name, PIN)
- Participant list
- Room controls
- Status indicators

### Participant List
- Avatar + Name
- Status indicator
- Role (Host / Member)

## Evaluation

### Strengths
- Room list layout is clear
- Room home page is well organized
- Participant list is readable
- SF UI Text is clean
- Inspired by Facebook Messenger (good UX reference)

### Mismatches with DontLift
- ⚠️ **May be light theme** (DontLift uses dark `#0B0F19`)
- ❌ **Group chat** (strict exclusion in DontLift)
- ❌ **Messaging** (strict exclusion in DontLift)
- ❌ **Social feed** (strict exclusion in DontLift)

### Application to DontLift
- **Use:**
  - Room list layout (My Rooms)
  - Room home page layout
  - Participant list structure
  - Avatar + Name + Status
  - Room header with PIN
- **Avoid:**
  - Group chat
  - Messaging
  - Social feed
  - Light theme (use dark `#0B0F19`)
- **Try:**
  - Glass card for room list
  - Participant list with state badges (ACTIVE / EARLY_EXIT)
  - Room header with PIN in glass
  - Host vs Member visual distinction