const fetch = require('node-fetch');

export async function graphql(query, variables) {
    const HASURA_GRAPHQL_URL =  process.env.HASURA_GRAPHQL_URL;
    const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
    const response = await fetch(HASURA_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
        },
        body: JSON.stringify({query, variables}),
    });

    const data = await response.json();
    if (!response.ok || data.errors) {
        throw new Error(data.errors ? data.errors[0].message : 'Unknown error');
    }

    return data;
}

