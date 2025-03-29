const webSocketManager = require('./apis/signal');
const { receive_raw_message } = require('./routes/ws');

webSocketManager.connect(receive_raw_message);

//TODO: Regularly remove cached messages in signal/data
//TODO: Implement iptables in docker container to block requests
/* 
* # Block all incoming connections to port 8080
* sudo iptables -A INPUT -p tcp --dport 8080 -j DROP
* 
* # Allow outgoing connections from the container to a specific URL (e.g., example.com)
* sudo iptables -A OUTPUT -p tcp -d example.com --dport 80 -j ACCEPT
*/
