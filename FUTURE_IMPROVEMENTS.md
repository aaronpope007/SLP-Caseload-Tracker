# Future Improvements & Roadmap

*Last Updated: January 2026*

This document tracks potential improvements and their implementation status.

---

## ✅ Recently Completed (January 2026)

### Security & Infrastructure
- [x] **API Input Validation** - Zod schemas for all API endpoints
- [x] **Environment-Based CORS** - Configurable CORS for production
- [x] **Rate Limiting** - Protect API from abuse (100 req/15min general, 10/15min for email)
- [x] **Authentication System** - JWT-based auth with bcrypt password hashing
- [x] **Database Backup System** - Create, restore, download backups via UI
- [x] **Structured Logging** - Pino logger with request logging
- [x] **Environment Validation** - Validate .env on startup with warnings

### Error Handling & UX
- [x] **React Error Boundaries** - Route-level error handling with recovery
- [x] **404 Page** - Custom not found page
- [x] **Frontend Validation Display** - useFormValidation hook for inline errors
- [x] **Defensive goalsTargeted Checks** - Fixed undefined access crashes

### Performance & Mobile
- [x] **Loading Skeletons** - Better perceived performance
- [x] **Mobile Responsive Theme** - Touch targets, dialog sizing
- [x] **ResponsiveDialog Component** - Full-screen dialogs on mobile

### Documentation & Testing
- [x] **API Documentation** - OpenAPI/Swagger at /api-docs
- [x] **Jest Integration Tests** - API validation tests

---

## 🔄 In Progress

*None currently*

---

## 📋 Planned Improvements

### 🟡 Medium Priority

| Feature | Description | Effort |
|---------|-------------|--------|
| **Frontend Component Tests** | React Testing Library tests for UI | ~3 hours |
| **PWA/Offline Support** | Installable app with offline mode | ~4 hours |
| **Database Migrations** | Versioned migrations with Knex | ~2 hours |
| **Accessibility Audit** | ARIA labels, keyboard nav, screen readers | ~3 hours |
| **Virtual Scrolling** | For lists with 100+ items | ~2 hours |

### 🟢 Nice to Have

| Feature | Description | Effort |
|---------|-------------|--------|
| **Bulk Operations** | Edit/delete multiple items | ~2 hours |
| **CSV Import** | Import students from spreadsheet | ~3 hours |
| **Keyboard Shortcuts** | Document and add shortcuts | ~1 hour |
| **Print Styles** | Better print layout for reports | ~1 hour |
| **Dark Mode Persistence** | Save theme to database | ~30 min |
| **Custom Fields** | User-defined fields for students/goals | ~4 hours |
| **PDF Export** | Generate PDF reports | ~3 hours |

---

## 🚀 Feature Roadmap

### Mobile & PWA
- [ ] Progressive Web App (PWA) manifest
- [ ] Service Worker for offline caching
- [ ] Push notifications for reminders
- [ ] Mobile-optimized session logging

### Collaboration
- [ ] Multi-user support with roles
- [ ] Share caseloads between SLPs
- [ ] Supervisor review workflow
- [ ] Comment/annotation system

### Advanced Analytics
- [ ] Goal achievement predictions
- [ ] Cohort comparison charts
- [ ] Custom report builder
- [ ] Benchmark comparisons

### Integrations
- [ ] Google Calendar sync
- [ ] Email service integration
- [ ] EHR system connectors
- [ ] Assessment tool imports

---

## 🔧 Technical Debt

### Code Quality
- [ ] Increase test coverage to 80%+
- [ ] Add E2E tests with Playwright
- [ ] Reduce largest components further
- [ ] Add Storybook for component docs

### Infrastructure
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Automated database backups
- [ ] Health check dashboard

### Security
- [ ] Security audit
- [ ] HIPAA compliance review
- [ ] Audit logging for data changes
- [ ] Session timeout handling

---

## 📊 Metrics

| Metric | Current | Target |
|--------|---------|--------|
| API Test Coverage | ~20% | 80% |
| Frontend Test Coverage | 0% | 60% |
| Largest Component | 421 lines | < 400 |
| API Response Time (avg) | ~50ms | < 100ms |
| Lighthouse Score | TBD | > 90 |

---

## 📝 Notes

- All improvements should maintain backward compatibility
- TypeScript strict mode should remain enabled
- New features should include tests
- Mobile-first approach for new UI components
