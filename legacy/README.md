# Legacy Proactive Suggestion System

This directory contains the legacy implementation of the proactive suggestion system that has been replaced by the enhanced version.

## Files

- **`proactive-service.ts`** - Legacy proactive service using rule-based suggestion generation
- **`suggestion-generator.ts`** - Rule-based suggestion generator (autocomplete pattern suggestions disabled)

## Status

These files are kept for reference but are **no longer actively used** in the application. All components have been migrated to use the enhanced proactive service (`proactive-service-enhanced.ts`) which provides:

- AI-driven suggestion generation
- Proper separation of micro and macro suggestions  
- Ghost preview rendering for micro suggestions
- Enhanced validation and redundancy prevention

## Migration

All components that previously imported from these legacy files have been updated to use the enhanced service:

- `chattab.tsx` → uses `proactive-service-enhanced`
- `instanceview.tsx` → uses `proactive-service-enhanced`  
- `ProactiveSettings.tsx` → uses `proactive-service-enhanced`
- `SuggestionTester.tsx` → uses `proactive-service-enhanced`

The enhanced service provides backward compatibility for all methods used by these components.
