const fs = require('fs');
const http = require('http');
const path = require('path');


// Mock the http module
jest.mock('http');

// Mock the fs module
jest.mock('fs');

// Mock the path module
jest.mock('path');

// Mock the pg module
jest.mock('pg', () => {
    const mockClient = {
        connect: jest.fn(),
        query: jest.fn(),
        end: jest.fn()
    };
    return {
        Client: jest.fn(() => mockClient)
    };
});

// Import the functions after mocking
const { load_sql_schema, upload_metadata, create_system } = require('../initialization/db_init');
const { Client } = require('pg');

describe('db_init.js', () => {
    let mockRequest;
    let mockResponse;
    let mockHttpRequest;
    let mockClient;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        
        // Mock path.join
        path.join.mockReturnValue('/mock/path/file.sql');
        
        // Mock pg Client
        mockClient = {
            connect: jest.fn(),
            query: jest.fn(),
            end: jest.fn()
        };
        Client.mockImplementation(() => mockClient);
        
        // Mock http.request
        mockRequest = {
            on: jest.fn(),
            write: jest.fn(),
            end: jest.fn()
        };
        
        mockResponse = {
            setEncoding: jest.fn(),
            on: jest.fn()
        };
        
        mockHttpRequest = jest.fn().mockReturnValue(mockRequest);
        http.request.mockImplementation(mockHttpRequest);
    });

    describe('load_sql_schema', () => {
        beforeEach(() => {
            fs.readFileSync.mockReturnValue('mock content');
        });
        it('should create pg Client and execute SQL query', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            // Mock successful pg operations
            mockClient.connect.mockResolvedValue();
            mockClient.query.mockResolvedValue();
            mockClient.end.mockResolvedValue();

            await load_sql_schema();

            expect(Client).toHaveBeenCalledWith({
                host: 'postgres',
                port: 5432,
                user: 'postgres',
                password: 'postgres',
                database: 'postgres'
            });

            expect(mockClient.connect).toHaveBeenCalled();
            expect(mockClient.query).toHaveBeenCalledWith('mock content');
            expect(mockClient.end).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith('SQL schema loaded successfully.');
            
            consoleSpy.mockRestore();
        });

        it('should handle pg Client connection errors', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock connection error
            mockClient.connect.mockRejectedValue(new Error('Connection failed'));

            await load_sql_schema();
            
            expect(consoleSpy).toHaveBeenCalledWith('Error loading SQL schema:', expect.any(Error));
            expect(mockClient.end).toHaveBeenCalled(); // Should still call end in finally block
            
            consoleSpy.mockRestore();
        });

        it('should handle pg query errors', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock successful connection but failed query
            mockClient.connect.mockResolvedValue();
            mockClient.query.mockRejectedValue(new Error('Query failed'));
            mockClient.end.mockResolvedValue();

            await load_sql_schema();
            
            expect(consoleSpy).toHaveBeenCalledWith('Error loading SQL schema:', expect.any(Error));
            expect(mockClient.end).toHaveBeenCalled(); // Should still call end in finally block
            
            consoleSpy.mockRestore();
        });
    });

    describe('upload_metadata', () => {
        beforeEach(() => {
            fs.readFileSync.mockReturnValue('{"mock": "metadata"}');
        });
        it('should read metadata file and define HTTP request function', () => {
            
            upload_metadata();

            expect(fs.readFileSync).toHaveBeenCalledWith('/mock/path/file.sql', 'utf8');
            // Note: upload_metadata only defines a function, doesn't execute it
        });

        it('should read metadata file successfully', () => {
            // Mock metadata file content
            fs.readFileSync.mockReturnValue('{"mock": "metadata"}');
            
            upload_metadata();

            expect(fs.readFileSync).toHaveBeenCalledWith('/mock/path/file.sql', 'utf8');
            // Note: upload_metadata only defines a function, doesn't execute it
        });
    });

    describe('create_system', () => {
        it('should create system community and announcement script', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock successful community creation response
            const communityResponse = {
                data: {
                    insert_communities_one: {
                        id: 'mock-community-id'
                    }
                }
            };
            
            // Mock successful script creation response
            const scriptResponse = {
                data: {
                    insert_scripts_one: {
                        id: 'mock-script-id'
                    }
                }
            };

            mockResponse.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback(JSON.stringify(communityResponse));
                }
                if (event === 'end') {
                    callback();
                }
            });

            create_system();
            
            // Simulate the response
            const responseCallback = http.request.mock.calls[0][1];
            responseCallback(mockResponse);

            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    hostname: 'graphql-engine',
                    port: 8080,
                    path: '/v1/graphql',
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                }),
                expect.any(Function)
            );

            expect(mockRequest.write).toHaveBeenCalledWith(
                expect.stringContaining('CreateSystemCommunity')
            );
            expect(mockRequest.end).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        xit('should handle community creation failure', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock failed community creation response
            const failedResponse = {
                data: null,
                errors: ['Community creation failed']
            };

            // Create a fresh mock response for this test
            const testMockResponse = {
                setEncoding: jest.fn(),
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        callback(JSON.stringify(failedResponse));
                    }
                    if (event === 'end') {
                        callback();
                    }
                })
            };

            create_system();
            
            // Simulate response
            const responseCallback = http.request.mock.calls[0][1];
            responseCallback(testMockResponse);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to create system community or retrieve id:',
                JSON.stringify(failedResponse)
            );
            consoleSpy.mockRestore();
        });

        xit('should handle JSON parsing errors', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            mockResponse.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback('invalid json');
                }
                if (event === 'end') {
                    callback();
                }
            });

            create_system();
            
            // Simulate response
            const responseCallback = http.request.mock.calls[0][1];
            responseCallback(mockResponse);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                'Error parsing create community response:',
                expect.any(Error),
                'invalid json'
            );
            consoleSpy.mockRestore();
        });

        xit('should handle HTTP request errors', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            create_system();
            
            // Simulate error
            const errorCallback = mockRequest.on.mock.calls.find(call => call[0] === 'error')[1];
            errorCallback(new Error('Create system error'));
            
            expect(consoleSpy).toHaveBeenCalledWith('Problem with create community request: Create system error');
            consoleSpy.mockRestore();
        });
    });

    // describe('Integration scenarios', () => {

    //     beforeEach(() => {
    //         fs.readFileSync.mockReturnValueOnce('mock content');
    //         fs.readFileSync.mockReturnValueOnce('{"mock": "metadata"}');
    //         jest.clearAllMocks();
    //     });
        
    //     it('should handle complete successful initialization flow', async () => {
    //         const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
    //         // Mock successful pg operations for load_sql_schema
    //         mockClient.connect.mockResolvedValue();
    //         mockClient.query.mockResolvedValue();
    //         mockClient.end.mockResolvedValue();
            
    //         // Mock successful responses for create_system operations
    //         const communityResponse = {
    //             data: {
    //                 insert_communities_one: {
    //                     id: 'mock-community-id'
    //                 }
    //             }
    //         };
            
    //         const scriptResponse = {
    //             data: {
    //                 insert_scripts_one: {
    //                     id: 'mock-script-id'
    //                 }
    //             }
    //         };


    //         // Test all functions using promises to ensure sequential completion
    //         await load_sql_schema();
    //         await upload_metadata();
            
    //         // Override the http.request mock for create_system - need to handle both requests
    //         let requestCallCount = 0;
    //         console.log('Mocking http.request');
    //         http.request.mockImplementation((options, callback) => {
    //             const mockReq = {
    //                 on: jest.fn(),
    //                 write: jest.fn(),
    //                 end: jest.fn()
    //             };
                
    //             // Simulate the response callback
    //             setTimeout(() => {
    //                 const mockRes = {
    //                     setEncoding: jest.fn(),
    //                     on: jest.fn((event, cb) => {
    //                         if (event === 'data') {
    //                             if (requestCallCount === 0) {
    //                                 console.log('Community creation response:', JSON.stringify(communityResponse));
    //                                 // First request - community creation
    //                                 cb(JSON.stringify(communityResponse));
    //                             } else {
    //                                 // Second request - script creation
    //                                 cb(JSON.stringify(scriptResponse));
    //                                 console.log('Script creation response:', JSON.stringify(scriptResponse));
    //                             }
    //                         }
    //                         if (event === 'end') {
    //                             cb();
    //                         }
    //                     })
    //                 };
    //                 callback(mockRes);
    //             }, 10); // Small delay to ensure async behavior
                
    //             requestCallCount++;
    //             return mockReq;
    //         });
            
    //         await create_system();

    //         // load_sql_schema now uses pg Client (no HTTP), upload_metadata makes 1 HTTP request, create_system makes 2 HTTP requests
    //         expect(http.request).toHaveBeenCalledTimes(3);
            
    //         consoleSpy.mockRestore();
    //     });
    // });
});
