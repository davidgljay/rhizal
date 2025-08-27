
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
    
    const post_metadata = () => {
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
};

//TODO: Create initial system
//TODO: Create announcement script
//TODO: Create community Info
//TODO: Upload and associate community scripts 




