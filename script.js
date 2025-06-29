// --- PREMIER POINT DE CONTRÔLE : Voir si le script charge du tout ---
// alert("1. script.js a commencé à s'exécuter !"); // Désactivé après le premier debug


// Ton API Key Gemini, insérée directement.
const GEMINI_API_KEY = "AIzaSyCQWmAaX7TH6_mYQFuk9TbbVK19wLBkxs4"; 

// --- Réglages pour l'OCR ---
const ENABLE_BINARIZATION = false; 
const BINARIZATION_THRESHOLD = 150; 

const INVERT_COLORS = false; 
const UPSCALE_FACTOR = 1; 

const DEBUG_SHOW_BINARIZED_IMAGE = true; 

// Le prompt pour Gemini pour les réponses QCM (lettre seulement)
const GEMINI_QCM_PROMPT_PREFIX = "Pour la question de QCM PMI/PMP suivante, réponds uniquement avec la lettre (A, B, C ou D) de la bonne réponse. Ne donne aucune explication, aucun autre texte, juste la lettre. La question est : ";


// --- Références aux éléments HTML (pour interagir avec la page) ---
const cameraFeed = document.getElementById('cameraFeed');
const photoCanvas = document.getElementById('photoCanvas'); 

const grayscaleCanvas = document.createElement('canvas');
grayscaleCanvas.style.display = 'none';
document.body.appendChild(grayscaleCanvas);

const invertedCanvas = document.createElement('canvas');
invertedCanvas.style.display = 'none';
document.body.appendChild(invertedCanvas);

const upscaledCanvas = document.createElement('canvas');
upscaledCanvas.style.display = 'none';
document.body.appendChild(upscaledCanvas);

const binarizedCanvas = document.createElement('canvas'); 
binarizedCanvas.style.display = 'none'; 
document.body.appendChild(binarizedCanvas); 


const captureButton = document.getElementById('captureButton');
const statusMessage = document.getElementById('statusMessage'); // Va être vidé mais on le garde pour les erreurs
const errorMessage = document.getElementById('errorMessage');
const loadingIndicator = document.getElementById('loadingIndicator');
const extractedQuestionText = document.getElementById('extractedQuestionText');
const geminiAnswerText = document.getElementById('geminiAnswerText');
const questionResultSection = document.getElementById('questionResult');
const answerResultSection = document.getElementById('answerResult');
const resultsContainer = document.getElementById('resultsContainer'); 

const debugBinarizedImage = document.getElementById('debugBinarizedImage');


let stream; 

// --- Fonction de démarrage de la caméra ---
async function startCamera() {
    // alert("3. Fonction startCamera() est appelée !"); // Désactivé après le debug
    try {
        console.log("startCamera: Tentative de démarrage de la caméra..."); 
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment' 
            } 
        }); 
        console.log("startCamera: Caméra démarrée avec succès."); 
        // alert("4. Caméra démarrée avec succès !"); // Désactivé après le debug
        
        // MODIFICATION : Message de statut initial plus court et direct
        statusMessage.textContent = ""; // Vide le statut pour une interface épurée
        captureButton.disabled = false;
    } catch (error) {
        // alert(`ERREUR CAMÉRA DANS CATCH : ${error.name}\nMessage : ${error.message}\n(...)`); // Désactivé après le debug
        console.error("startCamera: Erreur d'accès à la caméra :", error); 
        if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
             errorMessage.textContent = "Caméra arrière introuvable ou non accessible. Vérifiez si une autre application l'utilise ou si la permission est bloquée.";
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
             errorMessage.textContent = "Accès à la caméra refusé. Vous devez autoriser le navigateur à utiliser la caméra dans les réglages.";
        } else if (error.name === 'SecurityError') {
             errorMessage.textContent = "Problème de sécurité : L'accès à la caméra nécessite une connexion sécurisée (HTTPS).";
        } else {
            errorMessage.textContent = `Impossible d'accéder à la caméra : ${error.message}.`; 
        }
        captureButton.disabled = true;
    }
}

// --- Fonction pour prendre une photo et lancer le traitement ---
captureButton.addEventListener('click', async () => {
    if (!stream) {
        errorMessage.textContent = "La caméra n'est pas démarrée.";
        return;
    }

    statusMessage.textContent = ""; // Vide le statut au début du clic
    errorMessage.textContent = "";
    questionResultSection.style.display = "none";
    answerResultSection.style.display = "none";
    loadingIndicator.style.display = "flex";
    captureButton.disabled = true;
    debugBinarizedImage.style.display = "none"; 

    try {
        console.log("captureButton: Capture de l'image..."); 
        const context = photoCanvas.getContext('2d');
        photoCanvas.width = cameraFeed.videoWidth;
        photoCanvas.height = cameraFeed.videoHeight;
        context.drawImage(cameraFeed, 0, 0, photoCanvas.width, photoCanvas.height);
        console.log("captureButton: Image dessinée sur le canvas."); 

        let imageToOcrCanvas = photoCanvas; 

        console.log("captureButton: Début prétraitement."); 
        
        // MODIFICATION ICI : Suppression des statusMessage intermédiaires
        // statusMessage.textContent = "Conversion en niveaux de gris..."; 
        imageToOcrCanvas = await grayscaleImage(imageToOcrCanvas);

        if (INVERT_COLORS) {
            // statusMessage.textContent = "Inversion des couleurs..."; 
            imageToOcrCanvas = await invertImage(imageToOcrCanvas);
        }

        if (ENABLE_BINARIZATION) { 
            // statusMessage.textContent = "Préparation de l'image (binarisation)...";
            imageToOcrCanvas = await binarizeImage(imageToOcrCanvas); 
        }

        if (UPSCALE_FACTOR > 1) { 
            // statusMessage.textContent = "Agrandissement de l'image...";
            imageToOcrCanvas = await upscaleImage(imageToOcrCanvas, UPSCALE_FACTOR); 
        }
        
        if (DEBUG_SHOW_BINARIZED_IMAGE) { 
            debugBinarizedImage.src = imageToOcrCanvas.toDataURL('image/png', 1.0); 
            debugBinarizedImage.style.display = "block"; 
            console.log("captureButton: Image de débogage affichée."); 
        }
        
        // MODIFICATION ICI : Suppression du message "Envoi de l'image à l'OCR..."
        // statusMessage.textContent = "Envoi de l'image à l'OCR (Google Vision)...";
        const ocrText = await performOcr(imageToOcrCanvas.toDataURL('image/png', 1.0)); 

        if (!ocrText || ocrText.trim() === '') {
            errorMessage.textContent = "Aucun texte significatif n'a été détecté dans l'image.";
            loadingIndicator.style.display = "none";
            captureButton.disabled = false;
            return;
        }

        extractedQuestionText.textContent = ocrText;
        questionResultSection.style.display = "block";

        // MODIFICATION ICI : Suppression du message "Demande de réponse à Gemini..."
        // statusMessage.textContent = "Demande de réponse à Gemini..."; 
        const geminiAnswer = await getAnswerToGemini(ocrText); 

        geminiAnswerText.textContent = geminiAnswer;
        answerResultSection.style.display = "block";

        // MODIFICATION ICI : Suppression du message "Prêt pour la prochaine question."
        // statusMessage.textContent = "Prêt pour la prochaine question."; 

    } catch (error) {
        console.error("Erreur lors du traitement :", error); 
        errorMessage.textContent = `Une erreur est survenue : ${error