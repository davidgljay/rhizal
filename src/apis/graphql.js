const fetch = require('node-fetch');

export async function graphql(query, variables) {
    const GRAPHQL_URL =  process.env.GRAPHQL_URL;
    const GRAPHQL_ADMIN_SECRET = process.env.GRAPHQL_ADMIN_SECRET;
    const GRAPHQL_AUTH_HEADER = process.env.GRAPHQL_AUTH_HEADER || 'x-hasura-admin-secret';
    const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            [GRAPHQL_AUTH_HEADER]: GRAPHQL_ADMIN_SECRET,
        },
        body: JSON.stringify({query, variables}),
    });

    const data = await response.json();
    if (!response.ok || data.errors) {
        throw new Error(data.errors ? data.errors[0].message : 'Unknown error');
    }

    return data;
}

