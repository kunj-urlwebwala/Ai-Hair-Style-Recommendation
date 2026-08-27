# Salon AI Try-On — Mobile Interface Plan

## Product Intent

Salon AI Try-On is a customer-facing mobile experience that helps a person understand which hairstyles may suit them, then review generated visual try-ons before sharing a preference with their stylist. The core interaction is deliberately calm and private: a single guided portrait submission turns into a concise, explainable set of recommendations rather than an overwhelming gallery.

The app is designed for **portrait mobile use at 9:16**, with primary actions placed in the lower thumb zone, large tap targets, and iOS-native navigation conventions. The visual direction is editorial and premium: warm ivory surfaces, ink-black type, and a single plum accent that communicates personal style without competing with the hairstyle imagery.

## Screen List

| Screen                     | Primary content and functionality                                                                                                                                   | Layout and interaction details                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Welcome / Home**         | Introduces the virtual consultation, explains the privacy promise, and starts a new try-on.                                                                         | A vertical hero card with a face-outline illustration, three concise benefit rows, and a full-width lower action button labelled “Start my try-on.”          |
| **Choose a photo**         | Lets the user select a portrait from their library or take a new photo. Includes guidance on lighting, angle, and face visibility.                                  | A dashed portrait frame centered in the upper half, photo guidance in a soft note, and two prominent bottom actions: “Use photo library” and “Take a photo.” |
| **Photo review**           | Shows the selected portrait, allows replacement, and confirms consent to analyze the face only for the consultation.                                                | A full-width portrait preview with an overlaid replace control, a concise consent card, and a bottom “Analyze my look” action.                               |
| **Analysis progress**      | Provides meaningful feedback while the AI evaluates facial balance and prepares style directions.                                                                   | A calm animated progress card, portrait thumbnail, four sequential status messages, and no distracting controls.                                             |
| **Your style profile**     | Presents an approachable face-shape assessment, feature observations, confidence notes, and personalized style principles.                                          | Large profile title, compact information chips, prose recommendations, and a bottom action to review suggested hairstyles.                                   |
| **Recommended hairstyles** | Shows four ranked hairstyle cards with a style name, suitability reason, maintenance level, and preview availability.                                               | A swipe-friendly vertical list. Each card has a portrait silhouette, rank marker, hair texture tag, and “Try this look” action.                              |
| **Virtual try-on**         | Generates and displays the user’s requested hairstyle preview while preserving their original face and visible identity. Allows before/after comparison and saving. | One large image stage, segmented “Before / Preview” control, selected look information, and a persistent lower action for saving or trying another style.    |
| **Saved looks**            | Displays saved results from the current device session, enabling comparison and re-entry to a virtual preview.                                                      | A two-column visual gallery with an empty state that routes back to recommendations.                                                                         |

## Key User Flows

| Goal                                            | Flow                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Start an AI consultation**                    | Home → Start my try-on → Choose a photo → Photo review → Analyze my look → Analysis progress → Your style profile.                   |
| **Review a recommended style**                  | Your style profile → View my recommendations → Select a hairstyle card → Virtual try-on loading state → Generated hairstyle preview. |
| **Compare an original portrait with a preview** | Virtual try-on → Tap Before / Preview segmented control → Review identical face presentation with hairstyle-only modification.       |
| **Save an inspiration look**                    | Virtual try-on → Save look → Saved looks tab → Open saved card → Virtual try-on.                                                     |
| **Restart with another image**                  | Home or photo review → Choose a new photo → Replace previous customer image for a new local consultation.                            |

## Color Choices

| Role             | Color     | Usage                                                        |
| ---------------- | --------- | ------------------------------------------------------------ |
| **Canvas Ivory** | `#FBF7F2` | Main background; warm enough to flatter portrait imagery.    |
| **Porcelain**    | `#FFFFFF` | Elevated cards, modal surfaces, and photo frames.            |
| **Ink**          | `#211D21` | Primary typography and high-contrast icons.                  |
| **Mauve Plum**   | `#7A3E62` | Primary action, selection states, and brand mark.            |
| **Blush Mist**   | `#F3E4E9` | Secondary surfaces, progress cards, and selected-chip fills. |
| **Rose Clay**    | `#C97A78` | Small visual accents and warmth indicators.                  |
| **Sage**         | `#5F7E70` | Positive confirmation and saved-look states.                 |
| **Stone**        | `#8E8587` | Supporting text and inactive UI.                             |

## Domain Model

| Entity                      | Core fields                                                                                            | Purpose                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Consultation**            | `id`, `sourceImageUri`, `analysis`, `recommendations`, `createdAt`                                     | Holds a user’s analysis and style results.                         |
| **StyleAnalysis**           | `faceShape`, `observations`, `stylePrinciples`, `confidenceNote`                                       | Gives understandable explanations for recommendations.             |
| **HairstyleRecommendation** | `id`, `name`, `description`, `whyItWorks`, `maintenance`, `texture`, `tone`, `prompt`                  | Represents an individual recommendation and its generation prompt. |
| **TryOnResult**             | `id`, `consultationId`, `recommendationId`, `sourceImageUri`, `previewImageUri`, `status`, `createdAt` | Records an identity-preserving hairstyle preview.                  |

## Implementation Scope

The first release will support photo selection from the device, portrait review, a local AI-consultation demonstration flow, curated recommendation cards, before/after preview controls, and saved inspiration within the local device session. The visual architecture will clearly separate the photo source from generated preview output so a production AI endpoint can replace the demonstration logic without changing the customer experience.

The app must never characterize a person’s attractiveness or make sensitive inferences. Style suggestions will be framed as optional aesthetic directions, and the copy will explain that generated previews are visual guidance rather than guaranteed salon outcomes.

## Brand Asset Validation

The final **Mirror** app icon is a 1024 × 1024 PNG with a full-bleed ivory field, an editorial face-profile silhouette, and flowing mauve, rose-clay, and ink hair forms. It has no typography or rounded-corner mask and is used consistently for the application icon, splash icon, favicon, and Android foreground asset.
