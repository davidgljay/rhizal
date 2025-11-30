const { graphql } = require('../apis/graphql');

class Event {

    constructor(data) {
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                this[key] = data[key];
            }
        }
    }

    static async create(community_id, creator_id, title, description, start_time, end_time = null, location = null) {
        const CREATE_EVENT = `
mutation CreateEvent($community_id: uuid!, $creator_id: uuid!, $title: String!) {
  insert_events_one(
    object: {
        community_id: $community_id,
        creator_id: $creator_id,
        title: $title
    }
  ) {
    id
    title
    community_id
    creator_id
  }
}`;

        const variables = {
            community_id,
            creator_id,
            title
        };

        const result = await graphql(CREATE_EVENT, variables);
        return new Event(result.data.insert_events_one);
    }

    static async set_variable(event_id, variable, value) {
        const validVariables = ['title', 'description', 'start_time', 'end_time', 'location', 'step'];
        const variableTypes = {
            title: 'String',
            description: 'String',
            start_time: 'timestamptz',
            end_time: 'timestamptz',
            location: 'String',
            step: 'String'
        };

        if (!validVariables.includes(variable)) {
            throw new Error(`Invalid variable. Valid variables are: ${validVariables.join(', ')}`);
        }

        // Note: 'step' is not a real column in events table, but we'll handle it for consistency
        // with group_threads pattern. If needed, this could be stored in a separate table or JSON field.
        if (variable === 'step') {
            // For now, we'll skip setting step as it's not in the schema
            // This could be extended if events need step tracking
            return;
        }

        const query = `
mutation UpdateEventVariable($event_id: uuid!, $value: ${variableTypes[variable]}!) {
  update_events(where: {id: {_eq: $event_id}}, _set: {${variable}: $value}) {
    returning {
      id
      ${variable}
    }
  }
}`;

        const variables = { event_id, value };

        return await graphql(query, variables);
    }

    static async get_by_creator(creator_id) {
        const GET_EVENTS = `
query GetEvents($creator_id: uuid!) {
  events(where: {creator_id: {_eq: $creator_id}}, order_by: {start_time: desc}, limit: 1) {
    id
    title
    description
    start_time
    end_time
    location
    created_at
    community_id
    creator_id
  }
}`;

        const variables = { creator_id };

        const result = await graphql(GET_EVENTS, variables);
        return result.data.events.map(event => new Event(event))[0];
    }

    static async get(event_id) {
        const GET_EVENT = `
query GetEvent($id: uuid!) {
  events(where: {id: {_eq: $id}}) {
    id
    title
    description
    start_time
    end_time
    location
    created_at
    community_id
    creator_id
    community {
      id
      bot_phone
    }
    creator {
      id
      user {
        phone
      }
    }
  }
}`;

        const result = await graphql(GET_EVENT, { id: event_id });
        if (result.data.events.length === 0) {
            return null;
        }
        return new Event(result.data.events[0]);
    }
}

module.exports = Event;

