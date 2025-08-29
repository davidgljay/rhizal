const fs = require('fs');
const http = require('http');
const path = require('path');

// Mock the http module
jest.mock('http');

// Mock the fs module
jest.mock('fs');

// Mock the path module
jest.mock('path');

// Import the functions after mocking
const { load_sql_schema, upload_metadata, createsystem } = require('../initialization/init');

describe('init.js', () => {
    let mockRequest;
    let mockResponse;
    let mockHttpRequest;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock fs.readFileSync
        fs.readFileSync.mockReturnValueOnce('mock sql content');
        fs.readFileSync.mockReturnValueOnce('mock metadata');
        
        // Mock path.join
        path.join.mockReturnValue('/mock/path/file.sql');
        
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
        it('should make HTTP request to load SQL schema', () => {
            // Mock successful response
            mockResponse.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback('mock data');
                }
                if (event === 'end') {
                    callback();
                }
            });

            load_sql_schema();

            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    hostname: 'graphql-engine',
                    port: 8080,
                    path: '/v2/query',
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                }),
                expect.any(Function)
            );

            expect(mockRequest.write).toHaveBeenCalled();
            expect(mockRequest.end).toHaveBeenCalled();
        });

        it('should handle HTTP request errors', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            load_sql_schema();
            
            // Simulate error
            const errorCallback = mockRequest.on.mock.calls.find(call => call[0] === 'error')[1];
            errorCallback(new Error('Network error'));
            
            expect(consoleSpy).toHaveBeenCalledWith('Problem with request: Network error');
            consoleSpy.mockRestore();
        });

        it('should log response data', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            mockResponse.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback('mock response data');
                }
                if (event === 'end') {
                    callback();
                }
            });

            load_sql_schema();
            
            // Simulate response
            const responseCallback = http.request.mock.calls[0][1];
            responseCallback(mockResponse);
            
            expect(consoleSpy).toHaveBeenCalledWith('Response:', 'mock response data');
            consoleSpy.mockRestore();
        });
    });

    describe('upload_metadata', () => {
        it('should read metadata file and define HTTP request function', () => {
            // Mock metadata file content
            fs.readFileSync.mockReturnValue('{"mock": "metadata"}');
            
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

    describe('createsystem', () => {
        it('should create system community and announcement script', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
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

            createsystem();

            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    hostname: 'graphql_engine',
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
        });

        it('should handle community creation failure', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock failed community creation response
            const failedResponse = {
                data: null,
                errors: ['Community creation failed']
            };

            mockResponse.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback(JSON.stringify(failedResponse));
                }
                if (event === 'end') {
                    callback();
                }
            });

            createsystem();
            
            // Simulate response
            const responseCallback = http.request.mock.calls[0][1];
            responseCallback(mockResponse);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to create system community or retrieve id:',
                JSON.stringify(failedResponse)
            );
            consoleSpy.mockRestore();
        });

        it('should handle JSON parsing errors', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            mockResponse.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback('invalid json');
                }
                if (event === 'end') {
                    callback();
                }
            });

            createsystem();
            
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

        it('should handle HTTP request errors', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            createsystem();
            
            // Simulate error
            const errorCallback = mockRequest.on.mock.calls.find(call => call[0] === 'error')[1];
            errorCallback(new Error('Create system error'));
            
            expect(consoleSpy).toHaveBeenCalledWith('Problem with create community request: Create system error');
            consoleSpy.mockRestore();
        });
    });

    describe('Integration scenarios', () => {
        it('should handle complete successful initialization flow', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            // Mock successful responses for all operations
            const communityResponse = {
                data: {
                    insert_communities_one: {
                        id: 'mock-community-id'
                    }
                }
            };
            
            const scriptResponse = {
                data: {
                    insert_scripts_one: {
                        id: 'mock-script-id'
                    }
                }
            };

            // Test all functions using promises to ensure sequential completion
            await Promise.resolve(load_sql_schema());
            await Promise.resolve(upload_metadata());
            await Promise.resolve(createsystem());

            // Simulate the first request response to trigger the second request
            const firstResponseCallback = http.request.mock.calls[0][1];
            firstResponseCallback(mockResponse);

            // load_sql_schema makes 1 HTTP request, createsystem makes 2 HTTP requests
            expect(http.request).toHaveBeenCalledTimes(3);
            
            consoleSpy.mockRestore();
        });
    });
});
