const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages-container');
const installButton = document.getElementById('install-button');
const notificationPermissionButton = document.getElementById('notification-permission-button');
const statusIndicator = document.getElementById('status-indicator');

let deferredPrompt;

function getSenderInitial(sender) {
    return sender.charAt(0).toUpperCase();
}

function displayMessage(text, sender, timestamp) {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('flex', 'items-start', 'w-full', 'mb-2');

    const senderInitial = getSenderInitial(sender);
    const initialBubble = document.createElement('div');
    initialBubble.classList.add('sender-initial-bubble', 'text-lg');
    initialBubble.textContent = senderInitial;

    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble', 'p-3', 'shadow-sm');

    const senderNameColorClass = (sender === 'Sébastien') ? 'text-gray-500' : 'text-gray-700';
    const senderNameHtml = `<span class="text-xs font-semibold ${senderNameColorClass} mb-1">${sender}</span>`;

    if (sender === 'Sébastien') {
        messageWrapper.classList.add('justify-end');
        initialBubble.classList.add('sender-initial-mine', 'order-2');
        messageElement.classList.add('message-mine');
    } else {
        messageWrapper.classList.add('justify-start');
        initialBubble.classList.add('sender-initial-other', 'order-1');
        messageElement.classList.add('message-other');
    }

    messageElement.innerHTML = `
        ${senderNameHtml}
        <p class="text-sm font-normal">${text}</p>
        <span class="message-timestamp">${timestamp}</span>
    `;

    if (sender === 'Sébastien') {
        messageWrapper.appendChild(messageElement);
        messageWrapper.appendChild(initialBubble);
    } else {
        messageWrapper.appendChild(initialBubble);
        messageWrapper.appendChild(messageElement);
    }

    messagesContainer.appendChild(messageWrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function saveMessage(message) {
    const messages = JSON.parse(localStorage.getItem('messages')) || [];
    messages.push({ ...message, sent: false });
    localStorage.setItem('messages', JSON.stringify(messages));
}

function loadMessages() {
    const messages = JSON.parse(localStorage.getItem('messages')) || [];
    messagesContainer.innerHTML = '';
    if (messages.length === 0) {
         messagesContainer.innerHTML = `
            <div class="text-center text-gray-500 p-4 mt-auto">
                <p>Commencez à discuter !</p>
            </div>
        `;
    } else {
        messages.forEach(msg => displayMessage(msg.text, msg.sender, msg.timestamp));
    }
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (text) {
        const now = new Date();
        const timestamp = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const message = { text, sender: 'Sébastien', timestamp, id: Date.now() };

        displayMessage(message.text, message.sender, message.timestamp);
        saveMessage(message);

        messageInput.value = '';

        syncMessagesWithServer();

        setTimeout(() => {
            const responseText = `Bonjour !`;
            const otherSenderName = 'Alice';
            const responseTimestamp = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const responseMessage = { text: responseText, sender: otherSenderName, timestamp: responseTimestamp, id: Date.now() };
            displayMessage(responseMessage.text, responseMessage.sender, responseMessage.timestamp);
            const messages = JSON.parse(localStorage.getItem('messages')) || [];
            messages.push({ ...responseMessage, sent: true });
            localStorage.setItem('messages', JSON.stringify(messages));

            if (Notification.permission === 'granted') {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification('Nouveau message !', {
                        body: `${otherSenderName}: ${responseMessage.text}`,
                        icon: 'img/app-icon.png',
                        tag: 'new-message',
                    });
                });
            }
        }, 1500);
    }
}

async function syncMessagesWithServer() {
    if (!navigator.onLine) {
        console.log('Hors ligne. Synchronisation reportée.');
        return;
    }

    let messages = JSON.parse(localStorage.getItem('messages')) || [];
    const unsentMessages = messages.filter(msg => !msg.sent);

    if (unsentMessages.length === 0) {
        console.log('Aucun message en attente de synchronisation.');
        return;
    }

    console.log(`Tentative d'envoi de ${unsentMessages.length} message(s) au serveur...`);

    try {
        const response = await new Promise((resolve) => {
            setTimeout(() => {
                console.log('Simulating server response...');
                resolve({ status: 200, ok: true });
            }, 1000);
        });

        if (response.ok) {
            messages = messages.map(msg =>
                unsentMessages.some(uMsg => uMsg.id === msg.id) ? { ...msg, sent: true } : msg
            );
            localStorage.setItem('messages', JSON.stringify(messages));
            console.log('Message(s) synchronisé(s) avec succès !');
        } else {
            console.error('Échec de la synchronisation avec le serveur:', response.status);
        }
    } catch (error) {
        console.error('Erreur lors de la synchronisation des messages:', error);
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installButton.style.display = 'block';
});

installButton.addEventListener('click', async () => {
    if (deferredPrompt) {
        installButton.style.display = 'none';
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`L'utilisateur a répondu à l'invite d'installation: ${outcome}`);
        deferredPrompt = null;
    }
});

function updateNotificationButtonState() {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            notificationPermissionButton.textContent = 'Notifications Activées';
            notificationPermissionButton.disabled = true;
        } else if (Notification.permission === 'denied') {
            notificationPermissionButton.textContent = 'Notifications Bloquées';
            notificationPermissionButton.disabled = true;
        } else { // 'default'
            notificationPermissionButton.textContent = 'Activer Notifications';
            notificationPermissionButton.disabled = false;
        }
    } else {
        notificationPermissionButton.textContent = 'Notifications non supportées';
        notificationPermissionButton.disabled = true;
    }
}

notificationPermissionButton.addEventListener('click', () => {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            console.log('Permission de notification:', permission);
            updateNotificationButtonState();
        });
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker enregistré avec succès:', registration);
                updateOnlineStatus();
                syncMessagesWithServer();
            })
            .catch(error => {
                console.error('Échec de l\'enregistrement du Service Worker:', error);
            });
    });
}

function updateOnlineStatus() {
    if (navigator.onLine) {
        statusIndicator.classList.remove('bg-red-500');
        statusIndicator.classList.add('bg-green-500');
        statusIndicator.title = 'En ligne';
        syncMessagesWithServer();
    } else {
        statusIndicator.classList.remove('bg-green-500');
        statusIndicator.classList.add('bg-red-500');
        statusIndicator.title = 'Hors ligne';
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

window.addEventListener('DOMContentLoaded', () => {
    loadMessages();
    updateOnlineStatus();
    updateNotificationButtonState();
    setInterval(syncMessagesWithServer, 5000);
});

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
