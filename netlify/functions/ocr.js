const { ImageAnnotatorClient } = require('@google-cloud/vision');

// IMPORTANT : Récupère le CONTENU JSON de la clé depuis la variable d'environnement Netlify.
// Le nom de la variable est celui que tu viens de définir/renommer.
const GOOGLE_CLOUD_CREDENTIALS_CONTENT = process.env.GOOGLE_CLOUD_VISION_CREDENTIALS; // Utilise le nouveau nom


// Initialise le client avec les identifiants lits de la variable d'environnement.
// La variable doit contenir le contenu JSON complet de la clé de service.
const client = new ImageAnnotatorClient({
  credentials: JSON.parse(GOOGLE_CLOUD_CREDENTIALS_CONTENT),
});


exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
        };
    }

    try {
        const { imageData } = JSON.parse(event.body);

        console.log('OCR Function: 1. Données image reçues (longueur):', imageData ? imageData.length : 'N/A');
        console.log('OCR Function: 2. Début des données image:', imageData ? imageData.substring(0, 50) : 'No data'); 
        console.log('OCR Function: 3. Type d\'image détecté (si préfixe):', imageData ? imageData.split(';')[0] : 'N/A');

        const base64Data = imageData.replace(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/, '');

        console.log('OCR Function: 4. Données Base64 après nettoyage (longueur):', base64Data ? base64Data.length : 'N/A');
        console.log('OCR Function: 5. Début des données Base64 nettoyées:', base64Data ? base64Data.substring(0, 50) : 'No data'); 

        if (base64Data && base64Data.startsWith('data:image')) {
            console.error('OCR Function: ERREUR CRITIQUE: Le préfixe "data:image" est TOUJOURS PRÉSENT après nettoyage!');
            throw new Error("Préfixe d'image non supprimé correctement.");
        }
        if (!base64Data || base64Data.length < 100) { 
            console.error('OCR Function: ERREUR CRITIQUE: Données Base64 vides ou trop courtes après nettoyage!');
            throw new Error("Données d'image corrompues ou vides.");
        }

        const imageBuffer = Buffer.from(base64Data, 'base64');

        console.log('OCR Function: 6. Taille du Buffer image :', imageBuffer.length);

        const [result] = await client.textDetection({
            image: { content: imageBuffer }, 
        });

        const detections = result.textAnnotations;
        let extractedText = '';

        if (detections && detections.length > 0) {
            extractedText = detections[0].description;
        }

        console.log('OCR Function: 7. Texte extrait avec succès (début):', extractedText.substring(0, Math.min(extractedText.length, 100))); 

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: extractedText }),
        };

    } catch (error) {
        console.error('OCR Function: ERREUR CRITIQUE DANS LE BLOC TRY-CATCH :', error); 
        console.error('OCR Function: Nom de l\'erreur :', error.name);
        console.error('OCR Function: Message de l\'erreur :', error.message);
        console.error('OCR Function: Stack trace :', error.stack); 

        // Vérification spécifique pour l'authentification (erreur 16 de GCV)
        if (error.code && error.code === 16 && error.details && error.details.includes("API key not valid")) {
            console.error("OCR Function: Authentification GCV error. Vérifiez la variable d'environnement GOOGLE_CLOUD_VISION_CREDENTIALS et la facturation.");
        }
        
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: error.message || 'Erreur interne du serveur OCR' }),
        };
    }
};