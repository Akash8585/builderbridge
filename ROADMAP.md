# BuilderBridge Product Roadmap

Based on BuilderBridge's current state, approximately **54 major tasks** remain. Each major task can later be divided into smaller engineering tickets with owners, estimates, dependencies, and acceptance criteria.

## Delivery Summary

| Phase | Tasks | Outcome |
| --- | ---: | --- |
| Beta Critical | 24 | Controlled beta readiness |
| Public Launch | 18 | Serious public launch readiness |
| Product and Business | 12 | Commercial growth readiness |
| **Total** | **54** | Complete product roadmap |

## Beta Critical

Complete tasks 1-24 for a controlled beta.

> Current checkpoint: Tasks 1-14 are implemented. Continue with the next P0/P1 priority task.

- [x] 1. Add AI task progress and status-change proposals.
- [x] 2. Add actual start, actual finish, and percent-complete actions.
- [x] 3. Add AI weekly-plan and commitment actions.
- [x] 4. Add commitment completion and variance-reason actions.
- [x] 5. Add AI schedule-impact-request actions.
- [x] 6. Add AI baseline creation and comparison proposals.
- [x] 7. Add document-to-RFI actions.
- [x] 8. **P0 Hackathon priority:** Add document-to-submittal and roadblock actions.
- [x] 9. **P0 Hackathon priority:** Add permission checks to every AI tool.
- [x] 10. **P1 Hackathon polish:** Add OpenRouter model fallback and retry handling.
- [x] 11. Add rate limits and AI usage limits.
- [x] 12. **P0 Hackathon priority:** Test every AI read tool and confirmation action.
- [x] 13. Build the in-app PDF viewer.
- [x] 14. **P1 Hackathon polish:** Add exact-page citation navigation.
- [ ] 15. Highlight cited PDF passages.
- [ ] 16. Add scanned-PDF and image OCR.
- [ ] 17. **P1 Hackathon polish:** Add file upload quotas and stronger validation.
- [ ] 18. **P1 Hackathon polish:** Add file access and download auditing.
- [ ] 19. **P1 Hackathon polish:** Complete role and project permission auditing.
- [ ] 20. **P1 Hackathon polish:** Add complete activity logs for project changes.
- [ ] 21. Add production error monitoring and structured logs.
- [ ] 22. Add database backup and recovery checks.
- [ ] 23. **P0 Hackathon priority:** Build first-project onboarding and useful empty states.
- [ ] 24. **P0 Hackathon priority:** Complete mobile and accessibility testing.

## Public Launch

Complete tasks 1-42 for a serious public launch.

- [ ] 25. Add comments and mentions to project records.
- [ ] 26. Add email and in-app notifications.
- [ ] 27. Add notification preferences and digest emails.
- [ ] 28. Improve project invitations and role management.
- [ ] 29. Add approval workflows for important project changes.
- [ ] 30. Add daily field reports with photos and weather.
- [ ] 31. Add AI-generated daily and weekly reports.
- [ ] 32. Add meeting minutes and action-item tracking.
- [ ] 33. Add document folders, tags, disciplines, and types.
- [ ] 34. Add document revision and superseded-file tracking.
- [ ] 35. Add semantic search with Supabase `pgvector`.
- [ ] 36. Combine semantic and keyword search.
- [ ] 37. Add Primavera P6 schedule imports.
- [ ] 38. Add Microsoft Project and CSV imports.
- [ ] 39. Add schedule, RFI, submittal, and report exports.
- [ ] 40. Complete Procore production synchronization.
- [ ] 41. Complete Autodesk Construction Cloud synchronization.
- [ ] 42. Add integration retries, conflict handling, and sync logs.

## Product and Business

Complete tasks 43-54 to strengthen BuilderBridge for commercial growth.

- [ ] 43. Add milestones, project calendars, and working-day rules.
- [ ] 44. Strengthen critical-path and schedule-validation logic.
- [ ] 45. Add global project and document search.
- [ ] 46. Add customizable dashboards and saved views.
- [ ] 47. Improve tablet and field-mobile workflows.
- [ ] 48. Add offline-friendly field updates.
- [ ] 49. Complete Stripe billing and subscription management.
- [ ] 50. Enforce plan-level limits and usage tracking.
- [ ] 51. Build organization, workspace, and integration settings.
- [ ] 52. Add product analytics and onboarding completion tracking.
- [ ] 53. Add support, feedback, privacy, terms, and security pages.
- [ ] 54. Run security, performance, regression, and deployment testing.

## Recommended Delivery Order

1. AI write actions
2. Permissions and security
3. PDF viewer and OCR
4. Reliability and testing
5. Onboarding
6. Notifications
7. Imports and exports
8. Integrations
9. Billing

## Release Gates

- **Controlled beta:** Tasks 1-24 complete.
- **Public launch:** Tasks 1-42 complete.
- **Commercial growth:** Tasks 43-54 complete.
