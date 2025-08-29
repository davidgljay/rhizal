
const fs = require('fs');
const http = require('http');
const path = require('path');

const sqlFilePath = path.join(__dirname, 'rhizal_schema.sql');
const sql = fs.readFileSync(sqlFilePath, 'utf8');

const load_sql_schema = () => {

    const postData = JSON.stringify({
        type: "run_sql",
        args: {
          source: "default",
          sql: sql,
          cascade: false,
          read_only: false
        }
      });
      
      const options = {
        hostname: 'graphql-engine',
        port: 8080,
        path: '/v2/query',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          console.log('Response:', data);
        });
      });
      
      req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
      });
      
      req.write(postData);
      req.end();

};

const upload_metadata = () => {
    const metadataFilePath = path.join(__dirname, 'hasura_rhizal_medata.json');
    const metadata = fs.readFileSync(metadataFilePath, 'utf8');
    const postData = metadata;
    
    const options = {
        hostname: 'graphql_engine',
        port: 8080,
        path: '/v1/metadata',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            console.log('Metadata Response:', data);
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with metadata request: ${e.message}`);
    });

    req.write(postData);
    req.end();
};

//TODO: Create initial system
const createsystem = () => {
    // Mutation to create the system community
    const createCommunityMutation = JSON.stringify({
        query: `
            mutation CreateSystemCommunity {
              insert_communities_one(object: {
                bot_phone: "system",
                name: "system",
                description: "Used for system scripts and functions."
              }) {
                id
              }
            }
        `
    });

    const options = {
        hostname: 'graphql_engine',
        port: 8080,
        path: '/v1/graphql',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(createCommunityMutation)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                const community_id = response.data && response.data.insert_communities_one && response.data.insert_communities_one.id;
                if (!community_id) {
                    console.error('Failed to create system community or retrieve id:', data);
                    return;
                }

                // Now create the announcement script for this community
                const scriptJson = {
                    "0": {
                        "send": [
                            "Would you like to send an announcement to your entire community? Just enter the message here and I'll confirm that it looks good before sending. You can also cancel this process with #cancel."
                        ],
                        "on_receive": {
                            "if": "regex(message, /#cancel[^a-zA-Z0-9]/)",
                            "then": [
                                { "step": 3 }
                            ],
                            "else": [
                                { "set_message_type": { "type": "draft_announcement" } },
                                { "step": 1 }
                            ]
                        }
                    },
                    "1": {
                        "send": [
                            "Thanks! Does this look good? \n\n{{message}}\n\nPlease respond with 'yes' to send or 'no' to cancel."
                        ],
                        "on_receive": {
                            "if": "regex(message, /yes/)",
                            "then": [
                                { "send_announcement": true },
                                { "step": 2 }
                            ],
                            "else": [
                                { "step": 3 }
                            ]
                        }
                    },
                    "2": {
                        "send": [
                            "Great! Your announcement has been sent to your community."
                        ],
                        "on_receive": [
                            { "step": "done" }
                        ]
                    },
                    "3": {
                        "send": [
                            "Okay, I've canceled the announcement process. You can start it again with #announcement at any time."
                        ],
                        "on_receive": [
                            { "step": "done" }
                        ]
                    }
                };
                const announcementMutation = JSON.stringify({
                    query: `
                        mutation AnnouncementScript {
                          insert_scripts_one(
                            object: {
                              community_id: ${JSON.stringify(community_id)}, 
                              name: "announcement", 
                              script_json: ${JSON.stringify(scriptJson)}
                            }
                          ) {
                            id
                          }
                        }
                    `
                });

                const scriptOptions = {
                    hostname: 'graphql_engine',
                    port: 8080,
                    path: '/v1/graphql',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(announcementMutation)
                    }
                };

                const scriptReq = http.request(scriptOptions, (scriptRes) => {
                    let scriptData = '';
                    scriptRes.setEncoding('utf8');
                    scriptRes.on('data', (chunk) => {
                        scriptData += chunk;
                    });
                    scriptRes.on('end', () => {
                        try {
                            const scriptResponse = JSON.parse(scriptData);
                            if (scriptResponse.data && scriptResponse.data.insert_scripts_one && scriptResponse.data.insert_scripts_one.id) {
                                console.log('Announcement script created with id:', scriptResponse.data.insert_scripts_one.id);
                            } else {
                                console.error('Failed to create announcement script:', scriptData);
                            }
                        } catch (err) {
                            console.error('Error parsing announcement script response:', err, scriptData);
                        }
                    });
                });

                scriptReq.on('error', (e) => {
                    console.error(`Problem with announcement script request: ${e.message}`);
                });

                scriptReq.write(announcementMutation);
                scriptReq.end();

            } catch (err) {
                console.error('Error parsing create community response:', err, data);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with create community request: ${e.message}`);
    });

    req.write(createCommunityMutation);
    req.end();
};

//TODO: Create announcement script
//TODO: Create community Info
//TODO: Upload and associate community scripts 

// Export functions for testing
module.exports = {
    load_sql_schema,
    upload_metadata,
    createsystem
};




