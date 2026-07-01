import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import CourseDiscoveryPage from "./pages/CourseDiscoveryPage";
import CourseDetailPage from "./pages/CourseDetailPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";

import StudentDashboardPage from "./pages/student/StudentDashboardPage";
import CoursePlayerPage from "./pages/student/CoursePlayerPage";
import QuizPage from "./pages/student/QuizPage";
import QuizResultPage from "./pages/student/QuizResultPage";
import ProgressDashboardPage from "./pages/student/ProgressDashboardPage";
import AITutorPage from "./pages/student/AITutorPage";
import StudyResourcesPage from "./pages/student/StudyResourcesPage";

import InstructorDashboardPage from "./pages/instructor/InstructorDashboardPage";
import InstructorCoursesPage from "./pages/instructor/InstructorCoursesPage";
import CourseEditorPage from "./pages/instructor/CourseEditorPage";
import QuizEditorPage from "./pages/instructor/QuizEditorPage";
import CourseAnalyticsPage from "./pages/instructor/CourseAnalyticsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/courses" element={<CourseDiscoveryPage />} />
      <Route path="/courses/:slug" element={<CourseDetailPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/profile" element={<ProfileSettingsPage />} />
      </Route>

      <Route element={<ProtectedRoute allow={["STUDENT"]} />}>
        <Route path="/dashboard" element={<StudentDashboardPage />} />
        <Route path="/progress" element={<ProgressDashboardPage />} />
        <Route path="/learn/:slug" element={<CoursePlayerPage />} />
        <Route path="/learn/:slug/lesson/:lessonId" element={<CoursePlayerPage />} />
        <Route path="/quiz/:quizId" element={<QuizPage />} />
        <Route path="/quiz/attempts/:attemptId/result" element={<QuizResultPage />} />
        <Route path="/ai-tutor" element={<AITutorPage />} />
        <Route path="/study-resources" element={<StudyResourcesPage />} />
      </Route>

      <Route element={<ProtectedRoute allow={["INSTRUCTOR"]} />}>
        <Route path="/instructor" element={<InstructorDashboardPage />} />
        <Route path="/instructor/courses" element={<InstructorCoursesPage />} />
        <Route path="/instructor/courses/:id/edit" element={<CourseEditorPage />} />
        <Route path="/instructor/courses/:id/analytics" element={<CourseAnalyticsPage />} />
        <Route path="/instructor/quizzes/:quizId/edit" element={<QuizEditorPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
