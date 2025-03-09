import { receive_raw_message } from '../routes//ws';
import { receive_message } from '../handlers/receive_message';

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
                syncMessage: {
                    sentMessage: {
                        destination: '+10987654321',
                        message: 'Test message',
                    },
                },
            },
        };

        await receive_raw_message(msg);

        expect(receive_message).toHaveBeenCalledWith(
            '+11234567890',
            '+10987654321',
            'Test message',
            1741473723341
        );
    });

});