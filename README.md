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

1. Set up an external datastore which accepts GraphQL and tell Rhizal how to access it.
2. Download this repot and run it using Docker Compose.
3. Register a number for Rhizal to use on the Signal network.

### Step 1. Setting up a datastore.

Rhizal communicates with a datastore over a secure connection using GraphQL. For development I chose [Hasura](https://cloud.hasura.io/), which is free and which allows for servers hosted in a variety of locations, though this may be insufficiently secure for some applications.

1a. Set up a graphql compatible external datastore and create a .env file with the access credentials or otherwise store them as secure local environment variables. Rhizal expects three environment variables, which are listed in sample.env:

`
GRAPHQL_ADMIN_SECRET=SECRET_TO_AUTH_GRAPHQL_REQUESTS
GRAPHQL_URL=https://graphql.request.url
GRAPHQL_AUTH_HEADER=auth-header-for-graphql-secret
`

If you want to use Hasura to test Rhizal, you can do so using the following steps:

1. Create an account on [Hasura Cloud](https://cloud.hasura.io/projects).
2. Select "New Project" and choose a name for your project.
3. Click the Gear icon on your new project to go to the admin panel to reveal your GraphQL API URL and Admin secret. 

Then create a .env as follows:

`
GRAPHQL_ADMIN_SECRET=HASURA_ADMIN_SECRET
GRAPHQL_URL=https://yourapp.hasura.app/v1/graphql
GRAPHQL_AUTH_HEADER=x-hasura-admin-secret
`

1b. Initialize the expected data structure in your datastore.

Use the SQL in rhizal_schema.sql to initialize the proper schema in your database.
Use the metadata in hasura_rhizal_metadata.json to set up the proper GraphQL metadata in a system such as Hasura or Apollo.

### Step 2. Download and initialize Rhizal.

Clone this repository using `https://github.com/davidgljay/rhizal.git`
Ensure that the .env file from step 1 is in the root directory.
Ensure that [docker compose is installed](https://docs.docker.com/compose/install/)
Run using `docker compose up`


### Step 3. Registering a Signal Number

Rhizal uses the [Signal CLI REST API](https://github.com/bbernhard/signal-cli-rest-api) to send and receive messages on the Signal network. You will need to register a phone number for Rhizal to use. 

3a. Create a number capable of receiving text messages using a service such as Twilio. 

3b. Complete Signal's Capthca at the following url: https://signalcaptchas.org/registration/generate
Right click on the link which reads "Open Signal" and  copy the result to your clipboard.

3c. Then run the following command:

`
docker exec -it rhizal curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"captcha": "SIGNALCAPTCHA"}' \
  http://signal-cli/v1/register/+1234567890
`

Replacing "+12345678990" with the number you wish to register and "SIGNALCAPTCHA" with the captcha completed above.. This should trigger a verification text message.

3d. Submit the verification code sent to signal with the following command:

`
docker exec -it rhizal curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"pin": "6789"}' \
  http://signal-cli/v1/register/+1234567890/verify/12345
`

Where +1234567890 is replaced with the phone number you wish to registerd, "1234" is replaced with the verification code sent via text and "6789" is replaced by a pin created by you and used for account recovery.





