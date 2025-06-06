import { receive_raw_message } from '../routes//ws';
import { receive_message, receive_group_message } from '../handlers/receive_message';

jest.mock('../handlers/receive_message');

describe('receive_raw_message', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not call receive_message if msg is undefined', async () => {
        await receive_raw_message(undefined);
        expect(receive_message).not.toHaveBeenCalled();
    });

    it('should not call receive_message if msg.envelope is undefined', async () => {
        await receive_raw_message({ envelope: undefined });
        expect(receive_message).not.toHaveBeenCalled();
    });

    it('should not call receive_message if msg.envelope.syncMessage is undefined', async () => {
        await receive_raw_message({ envelope: { syncMessage: undefined } });
        expect(receive_message).not.toHaveBeenCalled();
    });

    it('should call receive_message with correct parameters when msg is valid', async () => {
        const msg = {
            envelope: {
                source: '+11234567890',
                timestamp: 1741473723341,
                sourceUuid: 'UUID',
                sourceName: 'Test User',
                dataMessage: {
                    message: 'Test message',
                    type: 'DELIVER',
                },
            },
            account: '+10987654321'
        };

        await receive_raw_message(msg);

        expect(receive_message).toHaveBeenCalledWith(
            'UUID',
            '+10987654321',
            'Test message',
            1741473723341,
            'Test User',
        );
    });

    it('should call receive_group_message with correct parameters when a group message is sent', async () => {
        const msg = {
            envelope: {
                source: '+11234567890',
                timestamp: 1741473723341,
                sourceName: 'Test User',
                sourceUuid: 'UUID',
                dataMessage: {
                    groupInfo: {
                        groupId: 'group123',
                    },
                    message: 'Group test message',
                    type: 'DELIVER',
                },
            },
            account: '+10987654321'
        };

        await receive_raw_message(msg);

        expect(receive_group_message).toHaveBeenCalledWith(
            'group123',
            'Group test message',
            'UUID',
            '+10987654321',
            'Test User',
            expect.any(Number)
        );
    });

    it('should call receive_group_message with correct parameters when a group joined', async () => {
        const msg = {
            envelope: {
                source: '+11234567890',
                timestamp: 1741473723341,
                sourceName: 'Test User',
                sourceUuid: 'UUID',
                dataMessage: {
                    groupInfo: {
                        groupId: 'group123',
                    },
                    type: 'DELIVER',
                },
            },
            account: '+10987654321',
        };

        await receive_raw_message(msg);

        expect(receive_group_message).toHaveBeenCalledWith(
            'group123',
            undefined,
            'UUID',
            '+10987654321',
            'Test User',
            expect.any(Number)
        );
    });

});