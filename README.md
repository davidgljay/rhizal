# Rhizal
A lightweight, AI-free chatbot for people whose Signal threads get too big and unweildly.

## Core Features
### Message Routing
Is a Signal thread getting too big an unweildly? Break it up into multiple, smaller conversations. If you invite Rhizal to these conversations, it will let you relay messages between them using hashtags. 

Say you are preparing for an event, and you have one thread focused on planning and one focused on promotion. Someone in the planning group could write "Curious if #promotion knows how many people we're expecting", and the message would be relayed. Someone in promotion could then respond "#planning we're expecting about 500 as of now."

### Onboarding
In addition to relaying messages, people can message a community's Rhizal bot directly. When they do, it will onboard them, letting them know about the community and collecting information that could be useful to organizers.

### Announcements
Once a Rhizal bot is set up, organizers can use it to make announcements to everyone who has onboarded.

### Event Registration
Organizers can send out event invitations via Rhizal, and community members can RSVP with a simple yes or no.

## Security
Rhizal is a being optimized for security but is still in early development. Not all security features have been implemented, and the codebase has not received the necessary review to be considered secure. At this stage, it should be used for light experimentation only. Rhizal retains data in the following ways:

* If the message is part of a one-on-one conversation with Rhizal (e.g. while a community member is onboarding or registering for an event) it is logged so that organizers can see it. If someone messages Rhizal directly their phone number is also logged so that Rhizal can respond. Implementers of Rhizal can easily swap out where this data is logged to meet their security requirements.
* If a message is part of a group thread that Rhizal has been invited into it ignores the message unless it includes a hashtag for another group, in which case it routes the message and then forgets it. No information is collected about who is in the group or how frequently they communicate.

Messages are sent and received via bbernhard/signal-cli-rest-api, which implements signal-cli to interact with the Signal network. They are then transmitted via a Docker network to Rhizal. Logged messages and associated data are stored in Hasura for now, though this can be easily swapped for any graphQL interface via environment variables.


## Getting Started

_Instructions coming soon_