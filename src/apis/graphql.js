const fetch = require('node-fetch');

export async function graphql(query, variables) {
    const GRAPHQL_URL =  'http://graphql-engine:8080/v1/graphql';
    const GRAPHQL_ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET;
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
        console.log(GRAPHQL_URL)
        console.log(response.status)
        throw new Error(data.errors ? data.errors[0].message : 'Unknown error');
    }

    return data;
}

