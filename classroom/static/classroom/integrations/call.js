import { getClassroomId } from "classroom/utils.js";
import { showNotification } from "js/tasks/utils.js";

export function initVideoCallPanel() {
    const callButton = document.getElementById('callButton');
    if (!callButton) return;

    let currentJaasApi = null;
    let mediaState = {
        audio: true,
        video: false
    };

    async function loadJitsiScript(jitsiScriptSrc) {
        return new Promise((resolve, reject) => {
            if (window.JitsiMeetExternalAPI) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = jitsiScriptSrc;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                if (window.JitsiMeetExternalAPI) {
                    resolve();
                } else {
                    reject(new Error('Jitsi script loaded but API not available'));
                }
            };

            script.onerror = () => reject(new Error('Failed to load Jitsi script'));

            document.head.appendChild(script);
        });
    }

    callButton.addEventListener('click', handleCallButtonClick);

    document.addEventListener('click', handleVideoPanelClick);

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    function handleFullscreenChange() {
        const videoPanel = document.getElementById('videoCallPanel');
        if (!videoPanel) return;

        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const icon = fullscreenBtn?.querySelector('i');
        const videoControlsPanel = document.getElementById('video-controls-panel');

        if (document.fullscreenElement) {
            if (icon) icon.className = 'bi bi-fullscreen-exit';
            if (videoControlsPanel) videoControlsPanel.style.display = 'none';
        } else {
            if (icon) icon.className = 'bi bi-arrows-fullscreen';
            if (videoControlsPanel) videoControlsPanel.style.display = 'flex';
        }
    }

    async function handleCallButtonClick() {
        if (callButton.disabled) return;

        try {
            callButton.disabled = true;
            await showVideoPanel();
        } catch (error) {
            console.error('Ошибка при открытии видеозвонка:', error);
            callButton.disabled = false;
            showNotification('Не удалось открыть видеозвонок');
        }
    }

    function handleVideoPanelClick(e) {
        const videoPanel = document.getElementById('videoCallPanel');
        if (!videoPanel) return;

        const target = e.target.closest('button');
        if (!target) return;

        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn && fullscreenBtn.contains(target)) {
            toggleFullscreen();
            return;
        }

        const micBtn = document.getElementById('micBtn');
        const cameraBtn = document.getElementById('cameraBtn');
        const screenBtn = document.getElementById('screenBtn');
        const endCallBtn = document.getElementById('endCallBtn');

        if (micBtn && micBtn.contains(target)) {
            toggleMicrophone();
            return;
        }

        if (cameraBtn && cameraBtn.contains(target)) {
            toggleCamera();
            return;
        }

        if (screenBtn && screenBtn.contains(target)) {
            toggleScreenShare();
            return;
        }

        if (endCallBtn && endCallBtn.contains(target)) {
            endCall();
            return;
        }
    }

    async function showVideoPanel() {
        try {
            const videoPanel = document.getElementById('videoCallPanel');
            const callButton = document.getElementById('callButton');

            if (!videoPanel || !callButton) {
                throw new Error('Элементы панели видеозвонка не найдены');
            }

            videoPanel.classList.remove('d-none');
            videoPanel.classList.add('d-flex');

            const videoControlsPanel = document.getElementById('video-controls-panel');
            if (videoControlsPanel) {
                videoControlsPanel.style.display = 'flex';
            }

            const fullscreenBtn = document.getElementById('fullscreenBtn');
            if (fullscreenBtn) {
                fullscreenBtn.querySelector('i').className = 'bi bi-arrows-fullscreen';
            }

            await initializeVideoCall();
        } catch (error) {
            console.error('Ошибка при показе панели видеозвонка:', error);
            hideVideoPanel();
            throw error;
        }
    }

    async function initializeVideoCall() {
        try {
            const classroomId = getClassroomId();
            if (!classroomId) {
                throw new Error('ID класса не найден');
            }

            const tokenResponse = await fetch(`/classroom/api/${classroomId}/get-jitsi-token/`);

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                throw new Error(`Ошибка сервера: ${tokenResponse.status} - ${errorText}`);
            }

            const data = await tokenResponse.json();

            if (!data.token) {
                throw new Error('Токен для видеозвонка не получен');
            }

            const jitsiScriptSrc = data.jitsi_script_src;
            if (!jitsiScriptSrc) {
                throw new Error('Не получена ссылка на скрипт Jitsi');
            }
            if (typeof JitsiMeetExternalAPI === 'undefined') {
                await loadJitsiScript(jitsiScriptSrc);
            }

            const jitsiToken = data.token;
            const roomName = data.room || `classroom-${classroomId}`;
            const displayName = data.display_name || 'Участник';

            const videoElement = document.getElementById('jitsiContainer');
            if (!videoElement) {
                throw new Error('Контейнер для видеозвонка не найден');
            }

            videoElement.innerHTML = '';

            const jitsiConfig = {
                roomName,
                parentNode: videoElement,
                configOverwrite: {
                    startWithAudioMuted: false,
                    startWithVideoMuted: true,
                    prejoinPageEnabled: false,
                    disableSimulcast: true,
                    enableNoisyMicDetection: false,
                    enableClosePage: false,
                    disableSettings: true,
                    disableProfile: true,
                    videoQuality: {
                        maxHeight: 480,
                        maxWidth: 640,
                    },
                    constraints: {
                        video: {
                            height: { ideal: 480, max: 480, min: 180 },
                            width: { ideal: 640, max: 640, min: 320 }
                        }
                    },
                    disableDeepLinking: true,
                },
                interfaceConfigOverwrite: {
                    APP_NAME: 'FastClass',
                    SHOW_JITSI_WATERMARK: false,
                    SHOW_WATERMARK_FOR_GUESTS: false,
                    SHOW_POWERED_BY: false,
                    TOOLBAR_BUTTONS: [],
                    CONNECTION_INDICATOR_DISABLED: true,
                    DEFAULT_BACKGROUND: '#fff',
                    FILM_STRIP_MAX_HEIGHT: 0,
                    VERTICAL_FILMSTRIP: false,
                    mobileAppPromo: false,
                },
                userInfo: {
                    displayName: displayName,
                    email: ''
                },
                jwt: jitsiToken,
            };

            currentJaasApi = new JitsiMeetExternalAPI('jitsi-linguaglow.ru', jitsiConfig);

            currentJaasApi.addEventListeners({
                'screenSharingStatusChanged': handleScreenSharingStatus,
                'errorOccurred': handleJitsiError,
                'videoConferenceJoined': handleConferenceJoined,
                'videoConferenceLeft': handleConferenceLeft,
                'readyToClose': handleReadyToClose,
            });

            const checkIframe = setInterval(() => {
                const iframe = videoElement.querySelector('iframe');
                if (iframe) {
                    clearInterval(checkIframe);
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.position = 'absolute';
                    iframe.style.top = '0';
                    iframe.style.left = '0';
                    iframe.style.aspectRatio = '16/9';
                    iframe.style.objectFit = 'cover';
                    iframe.style.overflow = 'hidden';
                }
            }, 100);
        } catch (error) {
            console.error('Ошибка инициализации видеозвонка:', error);
            showNotification('Не удалось подключиться к видеозвонку');
            throw error;
        }
    }

    function handleConferenceJoined() {
        console.log('Joined video conference');
        updateControlIcons();
    }

    function handleConferenceLeft() {
        console.log('Left video conference');
        if (currentJaasApi) {
            currentJaasApi.dispose();
            currentJaasApi = null;
        }
    }

    function handleReadyToClose() {
        console.log('Ready to close conference');
        if (currentJaasApi) {
            currentJaasApi.dispose();
            currentJaasApi = null;
        }
        hideVideoPanel();
    }

    function handleJitsiError(error) {
        console.error('Jitsi error:', error);
        const errorMessage = error.message || error.toString();

        if (errorMessage.includes('gum.not_found') || errorMessage.includes('devices not found')) {
            showNotification('Устройства не найдены. Проверьте подключение микрофона/камеры');
        } else if (errorMessage.includes('gum.not_allowed') || errorMessage.includes('permission denied')) {
            showNotification('Разрешите доступ к микрофону и камере. Попробуйте Chrome или Firefox');
        } else if (errorMessage.includes('gum.not_readable') || errorMessage.includes('could not start')) {
            showNotification('Ошибка доступа к устройствам. Попробуйте перезагрузить страницу');
        } else if (errorMessage.includes('gum.overconstrained')) {
            showNotification('Не удалось настроить устройства. Попробуйте другой браузер');
        } else {
            showNotification('Ошибка в видеозвонке');
        }
    }

    function handleScreenSharingStatus(status) {
        console.log('Screen sharing status:', status);
        if (status === 'failed') {
            showNotification('Демонстрация экрана недоступна. Разрешите доступ или попробуйте Chrome');
        }
    }

    function hideVideoPanel() {
        try {
            const videoPanel = document.getElementById('videoCallPanel');
            const callButton = document.getElementById('callButton');

            if (!videoPanel || !callButton) {
                throw new Error('Элементы панели видеозвонка не найдены');
            }

            if (currentJaasApi) {
                try {
                    currentJaasApi.executeCommand('hangup');
                    currentJaasApi.dispose();
                } catch (apiError) {
                    console.error('Ошибка при завершении видеозвонка:', apiError);
                }
                currentJaasApi = null;
            }

            const jitsiContainer = document.getElementById('jitsiContainer');
            if (jitsiContainer) {
                jitsiContainer.innerHTML = '';
            }

            videoPanel.classList.remove('d-flex');
            videoPanel.classList.add('d-none');

            callButton.disabled = false;

            resetVideoPanelState();
        } catch (error) {
            console.error('Ошибка при скрытии панели видеозвонка:', error);
            showNotification('Не удалось закрыть панель видеозвонка');

            const callButton = document.getElementById('callButton');
            if (callButton) {
                callButton.disabled = false;
            }
        }
    }

    function resetVideoPanelState() {
        try {
            mediaState = {
                audio: true,
                video: false
            };

            const micIcon = document.querySelector('#micBtn i');
            const cameraIcon = document.querySelector('#cameraBtn i');
            const screenIcon = document.querySelector('#screenBtn i');

            if (micIcon) {
                micIcon.className = 'bi bi-mic text-success';
            }

            if (cameraIcon) {
                cameraIcon.className = 'bi bi-camera-video-off text-danger';
            }

            if (screenIcon) {
                screenIcon.className = 'bi bi-display';
            }

            const videoControlsPanel = document.getElementById('video-controls-panel');
            if (videoControlsPanel) {
                videoControlsPanel.style.display = 'flex';
            }
        } catch (error) {
            console.error('Ошибка при сбросе состояния панели:', error);
        }
    }

    function updateControlIcons() {
        const micIcon = document.querySelector('#micBtn i');
        const cameraIcon = document.querySelector('#cameraBtn i');

        if (micIcon) {
            micIcon.className = mediaState.audio ? 'bi bi-mic text-success' : 'bi bi-mic-mute text-danger';
        }

        if (cameraIcon) {
            cameraIcon.className = mediaState.video ? 'bi bi-camera-video text-success' : 'bi bi-camera-video-off text-danger';
        }
    }

    function toggleMicrophone() {
        try {
            if (!currentJaasApi) {
                throw new Error('Видеозвонок не инициализирован');
            }

            currentJaasApi.executeCommand('toggleAudio');
            mediaState.audio = !mediaState.audio;
            updateControlIcons();
        } catch (error) {
            console.error('Ошибка при переключении микрофона:', error);
            mediaState.audio = !mediaState.audio;
            updateControlIcons();
        }
    }

    function toggleCamera() {
        try {
            if (!currentJaasApi) {
                throw new Error('Видеозвонок не инициализирован');
            }

            currentJaasApi.executeCommand('toggleVideo');
            mediaState.video = !mediaState.video;
            updateControlIcons();
        } catch (error) {
            console.error('Ошибка при переключении камеры:', error);
            mediaState.video = !mediaState.video;
            updateControlIcons();
        }
    }

    function toggleScreenShare() {
        try {
            if (!currentJaasApi) {
                throw new Error('Видеозвонок не инициализирован');
            }

            currentJaasApi.executeCommand('toggleShareScreen').catch(error => {
                console.error('Screen share error:', error);

                const errorMessage = error.message || error.toString();
                const userAgent = navigator.userAgent.toLowerCase();

                if (errorMessage.includes('canceled') ||
                    errorMessage.includes('user cancelled') ||
                    errorMessage.includes('user denied') ||
                    errorMessage.includes('NotAllowedError')) {
                    showNotification('Вы отменили доступ к экрану');
                } else if (errorMessage.includes('NotFoundError')) {
                    showNotification('Не найдено окно или экран для демонстрации');
                } else if (!window.location.protocol.includes('https') &&
                           !window.location.hostname.includes('localhost') &&
                           !window.location.hostname.includes('127.0.0.1')) {
                    showNotification('Для демонстрации экрана нужен HTTPS. Используйте Chrome или Firefox');
                } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
                    showNotification('Демонстрация экрана недоступна. Попробуйте Chrome.');
                } else {
                    showNotification('Демонстрация экрана недоступна. Попробуйте Chrome или Firefox');
                }
            });
        } catch (error) {
            console.error('Ошибка при переключении демонстрации экрана:', error);

            const errorMessage = error.message || error.toString();
            if (errorMessage.includes('canceled') || errorMessage.includes('denied')) {
                showNotification('Вы отменили доступ к экрану');
            } else {
                showNotification('Демонстрация экрана недоступна. Используйте Chrome.');
            }
        }
    }

    function toggleFullscreen() {
        try {
            const videoPanel = document.getElementById('videoCallPanel');
            if (!videoPanel) {
                throw new Error('Панель видеозвонка не найдена');
            }

            if (!document.fullscreenElement) {
                videoPanel.requestFullscreen().catch(err => {
                    console.error('Ошибка полноэкранного режима:', err);
                    showNotification('Не удалось перейти в полноэкранный режим');
                });
            } else {
                document.exitFullscreen().catch(err => {
                    console.error('Ошибка выхода из полноэкранного режима:', err);
                    showNotification('Не удалось выйти из полноэкранного режима');
                });
            }
        } catch (error) {
            console.error('Ошибка при переключении полноэкранного режима:', error);
            showNotification('Не удалось переключить режим отображения');
        }
    }

    function endCall() {
        try {
            hideVideoPanel();
        } catch (error) {
            console.error('Ошибка при завершении звонка:', error);
            showNotification('Не удалось завершить видеозвонок');
        }
    }
}