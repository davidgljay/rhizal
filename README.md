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

To install a local instance of Rhizal you will need to:

1. Find a phone number that can receive text messages to set up your Signal account. This number will need to be able to receive one text message and must not otherwise be associated with a Signal account (as other Signal communications could be disrupted or become confusing if mixed with Rhizal.)
2. Modify `/scripts_config/community_config.yml` to reflect information about your community, the phone number you will be using and your desired Signal username.
3. Modify the scripts in `/scripts_config` to meet your goals (see below). This step can also be done later.
4. Run `npm run rhizal-init` or `yarn rhizal-init` and follow the instructions.

If you run into problems, you can use `npm run wipe-db` and `npm run rhizal-init` to try again.

## Updating Scripts

Scripts are written in yaml, you can update them at any time with `npm run script-sync`

### The Basics

Scripts are broken into steps. Each step has two components, `send` and `on_receive`

`send` consists of an array of messages that will be sent in sequence. These messages can include variables, like `name` that refer to a user's name. More on these later.

A send component may look like this:

```
0:
  send:
    - "This is a test script."
    - "{{name}} how are you doing?"
```

`on_receive` components take actions when a message is received. The only required action is `step`, which triggers the next step of a script. A basic script may look like this.

```
0:
  send:
    - "How are you today?"
  on_receive:
    - step: 1
1:
  send:
    - "Thanks for letting me know!"
  on_receive:
    - step: "done"
```

This script will send a single message, wait for the user to respond, then say "Thanks for letting me know!" and complete. note that script completion should always be marked with `step: "done"`

### Advanced Configuration

Many other commands can be run on `on_receive`. Here's a complete list:

|**set_variable**| Stores a variable about the user that can be incorporated into messages later. |
|**set_group_variable**| Sets a variable about the group that the conversation is taking place in. |
|**set_message_type**| Tags the message when it is saved for easier retrieval later (e.g. saving messages as being tied to onboarding.)|
|**send_to_admins**| Forwards the messages to admins with a premable.|
|**if/then/else**| Can be used to create conditional logic.|

Here's an example of a more advanced script:

```
0:
    send:
        - "Thanks for inviting me to join! This is the Rhizal script. I'll completely ignore everything said in this group unless it contains a hashtag."
        - "If it does I'll route it to another group, then forget it."
        - "For example, writing a message with #leadership would route to the leadership group."
        - "To get you set up, what hashtag should others use to message this group? (e.g. #coolkids)"
        - "You can always change this in the future by writing #name."
    on_receive:
        if: "regex(message, /#\\w+/)"
        then:
            - set_group_variable:
                variable: "hashtag"
                value: "regex(message, /#\\w+/)"
            - send_to_admins:
                preamble: "A new group has been created with hashtag:"
            - step: 1
        else:
            - step: 2
```

This script tests the message against a regex to see if it includes a hashtag. If it does, then it sets a group variable based on that hashtag and messages admins about it. Otherwise it redirects to a separate step. Note that becuase the original message is being forwarded we don't need to include the hashtag in this preamble, but we could with `{{hashtag}}` if we wanted to.




