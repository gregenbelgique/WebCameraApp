// Ton API Key Gemini, insérée directement.
const GEMINI_API_KEY = "AIzaSyCQWmAaX7TH6_mYQFuk9TbbVK19wLBkxs4"; 

// --- Réglages pour l'OCR ---
const ENABLE_BINARIZATION = false; 
const BINARIZATION_THRESHOLD = 150; 

const INVERT_COLORS = false; 
const UPSCALE_FACTOR = 1; 

const DEBUG_SHOW_BINARIZED_IMAGE = true; 


// --- Références aux éléments HTML (pour interagir avec la page) ---
const cameraFeed = document.getElementById('cameraFeed');
const photoCanvas = document.getElementById('photoCanvas'); 

// CRÉATION DES CANVASES TEMPORAIRES ET AJOUT AU CORPS DU DOCUMENT
// Il est crucial que toutes ces lignes soient présentes et correctement exécutées.
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
const statusMessage = document.getElementById('statusMessage');
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
    try {
        console.log("startCamera: Tentative de démarrage de la caméra..."); 
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment' 
            } 
        }); 
        console.log("startCamera: Caméra démarrée avec succès."); 
        
        cameraFeed.srcObject = stream;
        statusMessage.textContent = "Caméra prête. Visez la question et appuyez sur le bouton.";
        captureButton.disabled = false;
    } catch (error) {
        alert(`ERREUR CAMÉRA : ${error.name}\nMessage : ${error.message}\n(Vérifiez aussi la console si possible pour plus de détails)`);
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

    statusMessage.textContent = "";
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
        
        statusMessage.textContent = "Conversion en niveaux de gris...";
        imageToOcrCanvas = await grayscaleImage(imageToOcrCanvas);
        console.log("captureButton: Après niveaux de gris. imageToOcrCanvas est un canvas ?", imageToOcrCanvas instanceof HTMLCanvasElement); 


        if (INVERT_COLORS) {
            statusMessage.textContent = "Inversion des couleurs...";
            imageToOcrCanvas = await invertImage(imageToOcrCanvas);
            console.log("captureButton: Après inversion. imageToOcrCanvas est un canvas ?", imageToOcrCanvas instanceof HTMLCanvasElement); 
        }

        if (ENABLE_BINARIZATION) { 
            statusMessage.textContent = "Préparation de l'image (binarisation)...";
            imageToOcrCanvas = await binarizeImage(imageToOcrCanvas); 
            console.log("captureButton: Après binarisation. imageToOcrCanvas est un canvas ?", imageToOcrCanvas instanceof HTMLCanvasElement); 
        }

        if (UPSCALE_FACTOR > 1) { 
            statusMessage.textContent = "Agrandissement de l'image...";
            imageToOcrCanvas = await upscaleImage(imageToOcrCanvas, UPSCALE_FACTOR); 
            console.log("captureButton: Après upscaling. imageToOcrCanvas est un canvas ?", imageToOcrCanvas instanceof HTMLCanvasElement); 
        }
        
        if (DEBUG_SHOW_BINARIZED_IMAGE) { 
            debugBinarizedImage.src = imageToOcrCanvas.toDataURL('image/png', 1.0); 
            debugBinarizedImage.style.display = "block"; 
            console.log("captureButton: Image de débogage affichée."); 
        }
        
        statusMessage.textContent = "Envoi de l'image à l'OCR (Google Vision)...";
        const ocrText = await performOcr(imageToOcrCanvas.toDataURL('image/png', 1.0)); 

        if (!ocrText || ocrText.trim() === '') {
            errorMessage.textContent = "Aucun texte significatif n'a été détecté dans l'image.";
            loadingIndicator.style.display = "none";
            captureButton.disabled = false;