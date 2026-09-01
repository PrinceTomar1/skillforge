// Realistic lesson content used as the "ground truth" material the RAG
// pipeline ingests, chunks, embeds, and retrieves from. Written as genuine
// technical explanations (not lorem ipsum) so semantic/lexical retrieval and
// AI-generated study resources have real substance to work with.

// Freely-licensed sample clips used as stand-in lesson videos (CC0, hosted by
// MDN — not the actual course footage, just something real that reliably
// loads in a <video> tag so the player UI is genuinely exercised). Verified
// directly: fast, stable downloads with proper CORS + range support. Several
// other "well-known" sample video CDNs (the old Google gtv-videos-bucket,
// samplelib.com) were tried first and turned out to return 403s or hang
// under load, so don't reach for those without re-verifying.
export const SAMPLE_VIDEOS = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
];

export interface LessonSeed {
  title: string;
  content: string;
  videoUrl: string;
  durationSeconds: number;
  quiz?: {
    title: string;
    passingScore: number;
    questions: Array<{ prompt: string; options: string[]; correctOption: number; explanation: string; topic: string }>;
  };
}

export interface ModuleSeed {
  title: string;
  description: string;
  lessons: LessonSeed[];
}

export interface CourseSeed {
  title: string;
  description: string;
  category: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  thumbnailSeed: string;
  modules: ModuleSeed[];
}

export const COURSES: CourseSeed[] = [
  {
    title: "Full-Stack Web Development with React & Node.js",
    description:
      "Build production-grade web applications from scratch using React, TypeScript, Node.js, and PostgreSQL. Covers component architecture, state management, REST API design, authentication, and deployment.",
    category: "Web Development",
    level: "INTERMEDIATE",
    thumbnailSeed: "webdev",
    modules: [
      {
        title: "React Fundamentals",
        description: "Core concepts for building modern, component-based user interfaces.",
        lessons: [
          {
            title: "Components, Props, and JSX",
            durationSeconds: 720,
            videoUrl: SAMPLE_VIDEOS[0],
            content: `React applications are built from components: independent, reusable pieces of UI that each manage their own markup and logic. A component is just a JavaScript function that returns JSX, a syntax extension that looks like HTML but compiles down to calls to React.createElement.

Props (short for "properties") are how data flows into a component from its parent. Props are read-only from the receiving component's perspective — a component must never mutate its own props. This one-directional data flow (parent to child) is what makes React applications predictable: given the same props, a component renders the same output every time, which is the foundation of React's "pure function" mental model for UI.

JSX allows embedding JavaScript expressions inside curly braces, e.g. <h1>{user.name}</h1>. Under the hood, JSX for <Welcome name="Alex" /> compiles to React.createElement(Welcome, { name: "Alex" }). Components can be split into as many small pieces as helps readability — extracting a component is the primary tool for managing complexity in a React codebase, the same way extracting a function is the primary tool in plain JavaScript.

Composition over inheritance is the recommended way to share code between components in React. Instead of building a class hierarchy, components accept a "children" prop or explicit render props to compose behavior, e.g. <Card><Avatar /><Bio /></Card>. This keeps component trees flat and easy to reason about.

Keys matter when rendering lists: React uses the "key" prop to match array items to DOM nodes across re-renders. Using an array index as a key is discouraged when the list can be reordered or filtered, because it causes React to misattribute state to the wrong item after the list changes; a stable, unique identifier (like a database id) should be used instead.`,
            quiz: {
              title: "Components & Props Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "What is the correct way for a component to update data it received via props?",
                  options: [
                    "Mutate the prop object directly",
                    "Call a callback function passed down from the parent",
                    "Use document.querySelector to update the DOM directly",
                    "Props cannot be changed by design, so nothing needs to happen",
                  ],
                  correctOption: 1,
                  explanation: "Props are read-only. To change data that lives in a parent, a child calls a callback prop the parent gave it, and the parent updates its own state.",
                  topic: "React Component Model",
                },
                {
                  prompt: "Why is using an array index as a React list `key` discouraged for reorderable lists?",
                  options: [
                    "It's a syntax error",
                    "It causes React to misattribute component state across re-renders when the list changes",
                    "It makes the JSX compiler slower",
                    "React doesn't allow numeric keys",
                  ],
                  correctOption: 1,
                  explanation: "Index-based keys are tied to position, not identity, so when items are reordered React can associate old state with the wrong item.",
                  topic: "React Component Model",
                },
              ],
            },
          },
          {
            title: "State Management with Hooks",
            durationSeconds: 840,
            videoUrl: SAMPLE_VIDEOS[1],
            content: `Hooks let function components hold state and side effects without being converted into classes. useState(initialValue) returns a [value, setValue] pair; calling setValue schedules a re-render with the new value. State updates in React are asynchronous and batched — multiple setState calls inside the same event handler are grouped into a single re-render for performance, so code should never rely on state having updated immediately after calling the setter.

When a state update depends on the previous state, the functional updater form should be used: setCount(prev => prev + 1) instead of setCount(count + 1). This avoids stale-closure bugs where a handler captured an old value of count from a previous render.

useEffect(fn, deps) runs a side effect after render and re-runs it whenever any value in the dependency array changes. An empty dependency array ([]) means the effect runs once after the initial render, mimicking componentDidMount. Omitting the dependency array entirely causes the effect to run after every render, which is rarely what's intended. Effects that create subscriptions or timers must return a cleanup function; React calls it before the next effect run and when the component unmounts, preventing memory leaks.

Custom hooks (functions whose name starts with "use") are the primary tool for sharing stateful logic between components, replacing older patterns like higher-order components and render props. A custom hook like useFetch(url) can encapsulate loading/error/data state and be reused across many components without duplicating logic.

useContext lets a component read a value from a Context Provider higher in the tree without prop-drilling it through every intermediate component. It's best used for values that many components need — theme, authenticated user, locale — not as a general-purpose global state replacement, since every consumer re-renders whenever the context value changes.`,
            quiz: {
              title: "Hooks & State Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "Why should setCount(prev => prev + 1) be preferred over setCount(count + 1) inside an event handler?",
                  options: [
                    "It runs faster",
                    "It avoids stale-closure bugs since it always receives the latest state value",
                    "It is required syntax in React 18",
                    "There is no difference",
                  ],
                  correctOption: 1,
                  explanation: "The functional updater form receives the true latest state at update time, avoiding bugs from batched or asynchronous updates.",
                  topic: "React Hooks",
                },
                {
                  prompt: "What happens if useEffect is called without a dependency array at all?",
                  options: [
                    "It never runs",
                    "It runs once, like componentDidMount",
                    "It runs after every render",
                    "It throws a compile error",
                  ],
                  correctOption: 2,
                  explanation: "With no dependency array, React has no way to know when to skip the effect, so it re-runs after every render.",
                  topic: "React Hooks",
                },
                {
                  prompt: "What is the main risk of using useContext as a general global-state replacement?",
                  options: [
                    "It's not risky at all",
                    "Every consumer of that context re-renders whenever the context value changes",
                    "Context cannot hold objects",
                    "Context only works with class components",
                  ],
                  correctOption: 1,
                  explanation: "All consumers of a Context re-render on every value change, which can cause performance problems if the context holds frequently-changing, broadly-used state.",
                  topic: "React Hooks",
                },
              ],
            },
          },
        ],
      },
      {
        title: "Building APIs with Node.js & Express",
        description: "Designing and securing REST APIs that a real frontend can depend on.",
        lessons: [
          {
            title: "RESTful API Design",
            durationSeconds: 660,
            videoUrl: SAMPLE_VIDEOS[2],
            content: `A RESTful API models an application's data as resources, addressed by URLs, manipulated through a small, consistent set of HTTP verbs. GET retrieves a resource and must never have side effects. POST creates a new resource under a collection (POST /courses). PATCH partially updates an existing resource; PUT conventionally replaces it wholesale. DELETE removes a resource. Using the verb to express the action — rather than encoding it in the URL, like /getCourses or /deleteCourse — is what makes an API "RESTful" rather than just an HTTP-based RPC interface.

Resource URLs should be nouns, not verbs, and collection endpoints should be plural: /courses for the collection, /courses/:id for a single item, and nested resources like /courses/:id/modules for a module that only makes sense in the context of its parent course.

HTTP status codes carry meaning that clients rely on. 200 OK is a successful GET/PATCH; 201 Created is a successful POST that created a resource, and should include a Location header or the created object in the body; 204 No Content is used for a successful action with nothing to return, like a DELETE. 400 Bad Request means the request itself was malformed (failed validation); 401 Unauthorized means the caller isn't authenticated at all; 403 Forbidden means they are authenticated but not allowed to do this specific thing; 404 Not Found means the resource doesn't exist (or, for privacy, that the caller isn't allowed to know it exists); 409 Conflict is used for things like duplicate unique fields.

Idempotency matters for reliability: GET, PUT, and DELETE should be idempotent — calling them multiple times with the same input produces the same end state — while POST is not idempotent, since each call is intended to create a new resource. This property is what allows clients and proxies to safely retry a failed request without double-submitting.

Pagination, filtering, and sorting are typically expressed as query parameters (?page=2&limit=20&sort=-createdAt) rather than new endpoints, keeping the resource model itself stable regardless of how it's queried.`,
            quiz: {
              title: "REST API Design Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "Which HTTP status code should a successful POST that creates a new resource return?",
                  options: ["200", "201", "204", "202"],
                  correctOption: 1,
                  explanation: "201 Created signals that a new resource now exists, typically alongside the created object or a Location header.",
                  topic: "REST API Design",
                },
                {
                  prompt: "What does it mean for an HTTP method to be idempotent?",
                  options: [
                    "It always returns the same status code",
                    "Calling it multiple times with the same input leaves the system in the same end state as calling it once",
                    "It cannot be cached",
                    "It requires authentication",
                  ],
                  correctOption: 1,
                  explanation: "Idempotency means repeated identical requests have the same effect as a single request, which is why GET/PUT/DELETE are expected to be idempotent but POST is not.",
                  topic: "REST API Design",
                },
              ],
            },
          },
          {
            title: "Authentication & Authorization",
            durationSeconds: 900,
            videoUrl: SAMPLE_VIDEOS[3],
            content: `Authentication answers "who is making this request?"; authorization answers "is this specific user allowed to do this specific thing?" A system can authenticate a user correctly and still need to reject the request if authorization fails — for example, a logged-in student trying to delete a course they don't own.

Passwords must never be stored in plain text. Instead, a slow, salted hashing algorithm designed for passwords — bcrypt, scrypt, or argon2 — is used. Bcrypt automatically generates and embeds a random salt per password and includes a configurable "cost factor" that controls how many rounds of hashing are performed, so the hashing can be made deliberately slow enough to resist brute-force and rainbow-table attacks even as hardware gets faster.

Session state can be kept in two broad ways: server-side sessions (a session ID cookie references state stored in the database or a store like Redis) or stateless tokens (a JWT that encodes the user's identity and is cryptographically signed, so the server can verify it without a database lookup). JWTs are commonly stored in an httpOnly cookie rather than localStorage, because httpOnly cookies are inaccessible to JavaScript and therefore not readable by an XSS payload, while anything in localStorage is fully exposed to any script running on the page.

Role-based access control (RBAC) assigns each user one or more roles (e.g., STUDENT, INSTRUCTOR), and middleware checks the caller's role before allowing access to a route — for example, only an INSTRUCTOR may create a course, and only the instructor who owns a specific course may edit or delete it. This second check — ownership, not just role — is essential; role alone is not enough to authorize actions on a specific resource.

CORS (Cross-Origin Resource Sharing) is a browser security mechanism, not a server security mechanism: it controls which origins a browser will allow to read the response of a cross-origin request. A permissive CORS policy does not protect an API on its own — proper authentication and authorization must still be enforced server-side for every request.`,
            quiz: {
              title: "Auth Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "Why is bcrypt preferred over a fast hash like SHA-256 for storing passwords?",
                  options: [
                    "Bcrypt produces shorter output",
                    "Bcrypt is deliberately slow and salted, which resists brute-force and rainbow-table attacks",
                    "SHA-256 cannot hash strings",
                    "Bcrypt is required by all databases",
                  ],
                  correctOption: 1,
                  explanation: "Bcrypt's configurable cost factor makes brute-forcing computationally expensive, and its built-in per-password salt defeats precomputed rainbow tables.",
                  topic: "Authentication",
                },
                {
                  prompt: "Why store a JWT in an httpOnly cookie instead of localStorage?",
                  options: [
                    "httpOnly cookies are bigger",
                    "localStorage is not supported in modern browsers",
                    "httpOnly cookies cannot be read by JavaScript, which limits exposure to XSS attacks",
                    "JWTs cannot be stored in cookies",
                  ],
                  correctOption: 2,
                  explanation: "Any script running on the page — including an injected XSS payload — can read localStorage, but not an httpOnly cookie.",
                  topic: "Authentication",
                },
                {
                  prompt: "A student is logged in and sends a valid request to delete a course owned by a different instructor. What should the API do?",
                  options: [
                    "Allow it, because the student is authenticated",
                    "Reject it — role-based access control alone isn't enough; ownership must also be checked",
                    "Allow it only if the student provides the instructor's password",
                    "Silently ignore the request with a 200",
                  ],
                  correctOption: 1,
                  explanation: "Authentication (who they are) and even a correct role aren't sufficient; resource-level authorization (do they own this specific course) must also be enforced.",
                  topic: "Authentication",
                },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    title: "Machine Learning Fundamentals with Python",
    description:
      "A practical introduction to machine learning: supervised and unsupervised learning, linear models, evaluation metrics, and the basics of neural networks, using Python and scikit-learn.",
    category: "Data Science",
    level: "BEGINNER",
    thumbnailSeed: "mlfundamentals",
    modules: [
      {
        title: "Foundations of Machine Learning",
        description: "The core vocabulary and problem types that every ML practitioner needs.",
        lessons: [
          {
            title: "Supervised vs Unsupervised Learning",
            durationSeconds: 780,
            videoUrl: SAMPLE_VIDEOS[0],
            content: `Machine learning problems are usually split into supervised and unsupervised learning based on whether the training data includes labels. In supervised learning, each training example comes with a known correct output — for example, an email labeled "spam" or "not spam," or a house's square footage paired with its actual sale price. The model's job is to learn a function that maps inputs to outputs well enough to generalize to new, unseen examples.

Supervised learning splits further into classification (predicting a discrete category, like spam/not-spam) and regression (predicting a continuous number, like a price). The choice of loss function used to train the model depends on this distinction: classification commonly uses cross-entropy loss, while regression commonly uses mean squared error.

Unsupervised learning works with unlabeled data and tries to find structure on its own. Clustering algorithms like k-means group similar examples together without being told what the groups mean. Dimensionality reduction techniques like PCA (Principal Component Analysis) compress high-dimensional data into fewer dimensions while preserving as much variance as possible, which is useful both for visualization and as a preprocessing step for other models.

A third category, reinforcement learning, trains an agent to take actions in an environment to maximize a cumulative reward signal, learning through trial and error rather than from a fixed labeled dataset. It's the paradigm behind systems that learn to play games or control robots.

Regardless of the paradigm, every ML workflow depends on splitting data into training, validation, and test sets. The model learns from the training set, hyperparameters are tuned using performance on the validation set, and the test set — touched only once, at the very end — gives an honest estimate of how the model will perform on genuinely new data. Evaluating a model on data it was trained on always overestimates real-world performance.`,
            quiz: {
              title: "ML Foundations Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "What is the key difference between supervised and unsupervised learning?",
                  options: [
                    "Supervised learning uses neural networks and unsupervised learning doesn't",
                    "Supervised learning trains on labeled data with known correct outputs; unsupervised learning finds structure in unlabeled data",
                    "Unsupervised learning is always more accurate",
                    "There is no meaningful difference",
                  ],
                  correctOption: 1,
                  explanation: "The presence or absence of labeled outputs during training is what defines supervised vs. unsupervised learning.",
                  topic: "ML Fundamentals",
                },
                {
                  prompt: "Why is a held-out test set evaluated only once, at the very end of a project?",
                  options: [
                    "To save compute time",
                    "Because repeatedly tuning based on test-set performance would leak information and overestimate real-world accuracy",
                    "Test sets can only be used one time technically",
                    "It's a legal requirement",
                  ],
                  correctOption: 1,
                  explanation: "If decisions are repeatedly made based on test-set results, the test set effectively becomes part of training, and its performance estimate stops being honest.",
                  topic: "ML Fundamentals",
                },
              ],
            },
          },
          {
            title: "Linear Regression and Model Evaluation",
            durationSeconds: 900,
            videoUrl: SAMPLE_VIDEOS[1],
            content: `Linear regression models the relationship between input features and a continuous target as a weighted sum: y = w1*x1 + w2*x2 + ... + b. Training means finding the weights (w) and bias (b) that minimize a loss function — almost always mean squared error (MSE) — over the training data. This is typically solved either in closed form (the normal equation) for small datasets, or iteratively via gradient descent for larger ones.

Gradient descent updates each weight in the direction that reduces the loss, scaled by a learning rate. Too small a learning rate makes training slow; too large a learning rate can cause the loss to diverge instead of converge. This is one of the most important hyperparameters to tune in almost any ML model, not just linear regression.

Evaluating a regression model typically uses MSE or its square root, RMSE (which is in the same units as the target, making it more interpretable), or R², which measures the proportion of variance in the target explained by the model, where 1.0 is a perfect fit and 0 means the model does no better than always predicting the mean.

For classification, accuracy (fraction of correct predictions) can be misleading on imbalanced datasets — a model that always predicts "not fraud" can be 99% accurate if fraud is rare, while being useless. Precision (of the positive predictions, how many were correct) and recall (of the actual positives, how many were found) are usually more informative, and the F1 score is their harmonic mean, useful when a single summary number is needed.

Overfitting occurs when a model fits the training data's noise rather than its underlying pattern, performing well on training data but poorly on new data. Regularization techniques like L1 (Lasso) and L2 (Ridge) add a penalty term to the loss based on the size of the model's weights, discouraging the model from relying too heavily on any single feature and generally improving generalization.`,
            quiz: {
              title: "Regression & Evaluation Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "Why can accuracy be a misleading metric on an imbalanced classification dataset?",
                  options: [
                    "Accuracy cannot be computed for imbalanced data",
                    "A model that always predicts the majority class can score high accuracy while being practically useless",
                    "Accuracy only works for regression",
                    "It's not misleading — accuracy is always the best metric",
                  ],
                  correctOption: 1,
                  explanation: "When one class dominates, always predicting it yields high accuracy despite the model never correctly identifying the minority class.",
                  topic: "Model Evaluation",
                },
                {
                  prompt: "What is the effect of setting the learning rate too high in gradient descent?",
                  options: [
                    "Training converges faster with no downside",
                    "The loss can diverge instead of converge",
                    "It has no effect on training",
                    "It only affects unsupervised learning",
                  ],
                  correctOption: 1,
                  explanation: "Overly large updates can overshoot the minimum repeatedly, causing the loss to oscillate or diverge rather than settle.",
                  topic: "Model Evaluation",
                },
              ],
            },
          },
        ],
      },
      {
        title: "Working with Neural Networks",
        description: "From a single perceptron to training deep networks without overfitting.",
        lessons: [
          {
            title: "Introduction to Neural Networks",
            durationSeconds: 840,
            videoUrl: SAMPLE_VIDEOS[2],
            content: `A neural network is built from layers of simple units (neurons), each computing a weighted sum of its inputs followed by a nonlinear activation function. Without a nonlinearity like ReLU, sigmoid, or tanh between layers, stacking multiple linear layers would collapse mathematically into a single linear layer, no matter how many layers were stacked — the nonlinearity is what gives deep networks the ability to approximate complex, non-linear functions.

A basic feedforward network (multilayer perceptron) has an input layer, one or more hidden layers, and an output layer. The output layer's activation depends on the task: a single sigmoid unit for binary classification, softmax across units for multi-class classification, and a linear (no activation) output for regression.

Training a neural network uses backpropagation: the loss is computed at the output, and the chain rule is applied layer by layer, backward through the network, to compute how much each weight contributed to the error. Gradient descent (or a variant like Adam, which adapts the learning rate per parameter) then nudges every weight slightly to reduce that error, repeated over many passes (epochs) through the training data.

ReLU (Rectified Linear Unit, max(0, x)) became the default hidden-layer activation for most networks because it's computationally cheap and avoids the "vanishing gradient" problem that sigmoid and tanh suffer from in deep networks — when those functions saturate near their extremes, their gradient approaches zero, and backpropagation has almost nothing to propagate backward through many layers.

Batch size and epochs control training dynamics: one epoch is one full pass over the training set, and the batch size determines how many examples are used to compute each gradient update. Smaller batches introduce more noise into training (which can help generalization) but are less computationally efficient per example than larger batches, which better utilize parallel hardware like GPUs.`,
            quiz: {
              title: "Neural Networks Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "Why does a neural network need nonlinear activation functions between layers?",
                  options: [
                    "Purely for computational speed",
                    "Without them, stacked linear layers collapse into a single linear function regardless of depth",
                    "Activations are only needed in the output layer",
                    "They are optional and rarely used in practice",
                  ],
                  correctOption: 1,
                  explanation: "Composing linear functions yields another linear function; nonlinearity between layers is what enables networks to model complex relationships.",
                  topic: "Neural Networks",
                },
                {
                  prompt: "Why is ReLU commonly preferred over sigmoid/tanh in deep hidden layers?",
                  options: [
                    "ReLU always produces better accuracy on every task",
                    "It avoids the vanishing gradient problem that sigmoid/tanh suffer from when saturated",
                    "ReLU is the only differentiable activation function",
                    "Sigmoid cannot be used in neural networks at all",
                  ],
                  correctOption: 1,
                  explanation: "Sigmoid and tanh saturate at their extremes, driving gradients toward zero across many layers; ReLU's gradient stays constant for positive inputs.",
                  topic: "Neural Networks",
                },
              ],
            },
          },
          {
            title: "Training, Overfitting, and Regularization",
            durationSeconds: 900,
            videoUrl: SAMPLE_VIDEOS[3],
            content: `A model that performs much better on training data than on validation data is overfitting: it has memorized noise or idiosyncrasies specific to the training set rather than learning patterns that generalize. A model that performs poorly on both training and validation data is underfitting, usually meaning it doesn't have enough capacity or hasn't trained long enough to capture the underlying pattern. Plotting training and validation loss over epochs — the "learning curve" — is the standard way to diagnose which situation a model is in.

Dropout is a regularization technique specific to neural networks: during training, a random subset of neurons is temporarily "dropped" (set to zero) on each forward pass, forcing the network to not rely too heavily on any single neuron or narrow co-adapted group of neurons. At inference time, dropout is turned off and outputs are scaled to account for the difference.

Early stopping monitors validation loss during training and stops once it stops improving (or starts getting worse) even though training loss may still be decreasing — this is one of the simplest and most effective ways to prevent overfitting, since it directly targets the point where the model starts memorizing rather than generalizing.

Data augmentation artificially expands the effective size of a training set by creating modified copies of existing examples — rotating or cropping images, or paraphrasing text — which helps the model learn features that are robust to those variations rather than overfitting to exact pixel values or exact wording.

Cross-validation, especially k-fold cross-validation, is used when the dataset is small enough that a single train/validation split would be noisy: the data is split into k folds, the model is trained k times (each time holding out a different fold for validation), and the results are averaged, giving a more reliable estimate of how the model will generalize than any single split would.`,
            quiz: {
              title: "Overfitting & Regularization Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "A model has very low training loss but much higher validation loss. What is this called?",
                  options: ["Underfitting", "Overfitting", "Early stopping", "Cross-validation"],
                  correctOption: 1,
                  explanation: "A large gap where training performance is much better than validation performance is the classic signature of overfitting.",
                  topic: "Overfitting & Regularization",
                },
                {
                  prompt: "What does dropout do during training?",
                  options: [
                    "Removes bad training examples from the dataset",
                    "Randomly zeroes out a subset of neurons on each forward pass to prevent over-reliance on specific neurons",
                    "Reduces the learning rate over time",
                    "Deletes the validation set",
                  ],
                  correctOption: 1,
                  explanation: "By randomly deactivating neurons each pass, dropout forces the network to distribute what it learns rather than depending on narrow co-adapted paths.",
                  topic: "Overfitting & Regularization",
                },
                {
                  prompt: "Why is early stopping effective against overfitting?",
                  options: [
                    "It increases the batch size automatically",
                    "It halts training at the point where validation performance stops improving, before the model starts memorizing training noise",
                    "It guarantees the highest possible training accuracy",
                    "It replaces the need for a validation set",
                  ],
                  correctOption: 1,
                  explanation: "Early stopping directly targets the moment generalization starts to degrade, rather than letting the model keep fitting training-set noise.",
                  topic: "Overfitting & Regularization",
                },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    title: "Generative AI & Large Language Models",
    description:
      "Understand how modern LLMs actually work — transformers, attention, prompting — and build a real Retrieval-Augmented Generation (RAG) pipeline: embeddings, vector search, and grounded generation.",
    category: "Artificial Intelligence",
    level: "INTERMEDIATE",
    thumbnailSeed: "genai",
    modules: [
      {
        title: "How LLMs Work",
        description: "The transformer architecture and how it's used to generate and follow instructions.",
        lessons: [
          {
            title: "Transformers and Attention",
            durationSeconds: 900,
            videoUrl: SAMPLE_VIDEOS[0],
            content: `The transformer architecture, introduced in the 2017 paper "Attention Is All You Need," replaced the recurrent (step-by-step) processing used by older sequence models with a mechanism called self-attention that lets every token in a sequence directly attend to every other token in parallel. This parallelism is a major reason transformers scale so well on modern GPU/TPU hardware compared to RNNs, which had to process tokens one at a time.

Self-attention works by projecting each token's embedding into three vectors: a Query, a Key, and a Value. For each token, its Query vector is compared against every other token's Key vector (via a dot product) to produce attention scores, which are turned into weights via softmax. The token's new representation is a weighted sum of all tokens' Value vectors, using those weights — in effect, each token asks "which other tokens are relevant to understanding me?" and pulls in information from them accordingly.

Multi-head attention runs several attention computations in parallel with different learned projections, letting the model capture different kinds of relationships simultaneously — for example, one head might track subject-verb agreement while another tracks coreference between a pronoun and the noun it refers to.

Because self-attention has no inherent sense of token order (it treats the sequence as an unordered set unless told otherwise), positional encodings are added to each token's embedding to inject information about its position in the sequence.

A large language model is trained via next-token prediction: given a sequence of tokens, predict the most likely next token, over and over across a massive text corpus. This deceptively simple objective, combined with enough scale (parameters, data, compute), gives rise to capabilities — like following instructions, writing code, or reasoning through multi-step problems — that were not explicitly programmed and are often described as "emergent" because they appear more reliably only past certain scale thresholds.`,
            quiz: {
              title: "Transformers Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "What key advantage does self-attention have over the recurrent processing used in older sequence models?",
                  options: [
                    "It uses less memory in all cases",
                    "It lets every token attend to every other token in parallel rather than processing step by step",
                    "It removes the need for training data",
                    "It only works on short sequences",
                  ],
                  correctOption: 1,
                  explanation: "Self-attention's parallelism (versus RNNs' sequential processing) is a major reason transformers scale efficiently on modern hardware.",
                  topic: "Transformers",
                },
                {
                  prompt: "Why are positional encodings added to token embeddings in a transformer?",
                  options: [
                    "To reduce the vocabulary size",
                    "Self-attention has no inherent notion of token order, so position must be injected explicitly",
                    "To speed up softmax computation",
                    "They are only used during fine-tuning",
                  ],
                  correctOption: 1,
                  explanation: "Without positional information, self-attention treats input as an unordered set of tokens, so order must be added back in explicitly.",
                  topic: "Transformers",
                },
              ],
            },
          },
          {
            title: "Prompting and In-Context Learning",
            durationSeconds: 780,
            videoUrl: SAMPLE_VIDEOS[1],
            content: `In-context learning is the ability of a large language model to adapt its behavior based purely on examples or instructions given in the prompt, without any weight updates. This is fundamentally different from traditional machine learning, where adapting a model to a new task requires retraining or fine-tuning on labeled examples.

Zero-shot prompting asks the model to perform a task with only an instruction and no examples ("Classify this review as positive or negative: ..."). Few-shot prompting includes a handful of example input/output pairs directly in the prompt before the real query, which often substantially improves accuracy and output format consistency on tasks the model hasn't seen instructions for before.

Chain-of-thought prompting asks the model to reason step by step before giving a final answer (e.g., "Let's think step by step"), which measurably improves performance on multi-step reasoning and arithmetic tasks compared to asking for the answer directly, likely because it gives the model's next-token-prediction process intermediate steps to condition on rather than forcing it to jump straight to a conclusion.

System prompts set persistent instructions and constraints that apply across an entire conversation — tone, role, rules the model should follow, formatting requirements — separately from the user's actual messages. This separation is what lets an application like an AI tutor enforce behavior (e.g., "only answer from the provided course material") consistently regardless of what a user asks.

Prompt engineering is inherently empirical: small wording changes, the order of instructions, and where examples are placed can all measurably change output quality, so production prompts are typically developed iteratively and evaluated against real test cases rather than designed correctly on the first attempt. Because model behavior can shift between model versions, prompts that work well for one model or version are not guaranteed to transfer unchanged to another.`,
            quiz: {
              title: "Prompting Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "What is in-context learning?",
                  options: [
                    "Retraining the model's weights on new labeled data",
                    "The model adapting its behavior based on instructions/examples in the prompt, without any weight updates",
                    "A method for compressing model weights",
                    "A synonym for fine-tuning",
                  ],
                  correctOption: 1,
                  explanation: "In-context learning happens purely at inference time via the prompt's content — no gradient updates or retraining occur.",
                  topic: "Prompting",
                },
                {
                  prompt: "Why does chain-of-thought prompting tend to improve performance on multi-step reasoning tasks?",
                  options: [
                    "It makes the model faster",
                    "It reduces the number of tokens generated",
                    "It gives the model's next-token generation intermediate steps to condition on, rather than jumping straight to a conclusion",
                    "It is required for the model to produce any output",
                  ],
                  correctOption: 2,
                  explanation: "Writing out intermediate reasoning steps gives the autoregressive generation process more relevant context to condition each subsequent token on.",
                  topic: "Prompting",
                },
              ],
            },
          },
        ],
      },
      {
        title: "Retrieval-Augmented Generation",
        description: "Grounding an LLM's answers in real documents instead of relying only on its training data.",
        lessons: [
          {
            title: "Embeddings and Vector Search",
            durationSeconds: 840,
            videoUrl: SAMPLE_VIDEOS[2],
            content: `An embedding is a dense numerical vector representation of a piece of text (or an image, or other data) such that semantically similar inputs are mapped to nearby points in the vector space. Embedding models are trained so that, for example, the vectors for "how do I reset my password" and "steps to change my login credentials" end up close together even though they share almost no exact words, which is exactly what makes embeddings useful for semantic search — search based on meaning rather than exact keyword matching.

Similarity between two embedding vectors is typically measured with cosine similarity (the cosine of the angle between them, ranging from -1 to 1, where 1 means identical direction) or, equivalently for normalized vectors, by Euclidean or dot-product distance. Most vector databases let you choose which distance metric to index with, and it must match the metric the embedding model was trained/optimized for.

A vector database (or a relational database extended with a vector type, like PostgreSQL with the pgvector extension) stores these embeddings alongside metadata and supports approximate nearest-neighbor (ANN) search: given a query vector, quickly find the k stored vectors closest to it, without scanning every row with an expensive exact comparison. Index structures like HNSW (Hierarchical Navigable Small World) or IVFFlat make this fast even over millions of vectors, trading a small amount of recall accuracy for large speed gains compared to brute-force search.

Chunking is a crucial and easy-to-underestimate step before embedding: documents are split into smaller passages (commonly a few hundred words, sometimes with overlap between consecutive chunks) before each chunk is embedded separately. Chunks that are too large dilute a passage's specific meaning into an average that matches nothing well; chunks that are too small lose surrounding context needed to make sense of the passage. Overlap between chunks helps avoid losing meaning at chunk boundaries, where a sentence might otherwise be split in half.

Not all embeddings come from paid APIs — deterministic techniques like feature hashing (hashing tokens into fixed vector positions) can produce a lexical, bag-of-words-style vector that still supports meaningful nearest-neighbor search, though with weaker semantic understanding than a trained embedding model, since it captures shared vocabulary rather than shared meaning.`,
            quiz: {
              title: "Embeddings & Vector Search Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "What property makes embeddings useful for semantic search?",
                  options: [
                    "They compress text to save storage regardless of meaning",
                    "Semantically similar inputs are mapped to nearby points in the vector space, even without shared exact words",
                    "They only work on numeric data",
                    "They eliminate the need for a database",
                  ],
                  correctOption: 1,
                  explanation: "Nearness in embedding space corresponds to similarity in meaning, which is what lets search work by meaning rather than exact keyword overlap.",
                  topic: "Embeddings",
                },
                {
                  prompt: "Why is chunking documents before embedding important?",
                  options: [
                    "It's only needed for very short documents",
                    "Chunks that are too large dilute meaning into an average that matches nothing well, while chunks that are too small lose needed context",
                    "Embedding models cannot process more than one sentence",
                    "It has no effect on retrieval quality",
                  ],
                  correctOption: 1,
                  explanation: "Chunk size is a real tradeoff between specificity and context, which directly affects how well a query vector matches the right passage.",
                  topic: "Embeddings",
                },
                {
                  prompt: "What do ANN index structures like HNSW trade off to make vector search fast over large datasets?",
                  options: [
                    "They trade a small amount of recall accuracy for large gains in query speed compared to brute-force search",
                    "They trade storage space for slower queries",
                    "They require the embeddings to be integers",
                    "They eliminate the need for embeddings entirely",
                  ],
                  correctOption: 0,
                  explanation: "Approximate nearest-neighbor search sacrifices a small amount of exactness for large speed gains, which is the right tradeoff at scale.",
                  topic: "Embeddings",
                },
              ],
            },
          },
          {
            title: "Building a RAG Pipeline",
            durationSeconds: 960,
            videoUrl: SAMPLE_VIDEOS[3],
            content: `Retrieval-Augmented Generation (RAG) combines a retrieval system with a generative LLM so the model's answers are grounded in specific, up-to-date, or private documents rather than relying solely on whatever it memorized during training. The core pipeline has five stages: ingest documents, chunk and clean the text, embed each chunk and store it in a vector index, retrieve the most relevant chunks for an incoming query, and finally construct a prompt that includes those chunks as context before calling the LLM to generate an answer.

RAG solves two problems that a raw LLM has on its own. First, hallucination: without grounding, a model can state confident-sounding but false facts, especially about narrow or private information it never saw during training (like a specific company's internal documents, or a specific course's lesson content). Second, staleness: a model's training data has a cutoff date, so it cannot know about information created afterward, while a RAG system's knowledge is only as current as its document index, which can be updated at any time without retraining the model.

The retrieval step should be scoped appropriately — for example, restricting search to only the documents belonging to a specific course when a student asks the AI tutor a question, rather than searching across all courses. This scoping both improves relevance (less noise competing for the top results) and prevents information leaking across contexts where it doesn't belong.

Prompt construction is where retrieved chunks get turned into grounding for the LLM: a system prompt instructs the model to answer using only the provided context, to cite which piece of context supports each claim, and — critically — to say explicitly when the context doesn't contain the answer rather than falling back on its own possibly-wrong general knowledge. This explicit "I don't know" instruction is one of the most effective ways to reduce hallucination in a RAG system, because it gives the model permission to decline rather than guess.

A well-built RAG system keeps ingestion, embedding, retrieval, and generation as separate, independently testable stages. This separation matters in practice: it means the embedding provider or the LLM provider can each be swapped independently, retrieval quality can be evaluated without needing to also evaluate generation quality, and failures at one stage (e.g., a document failing to ingest) don't silently corrupt the others.`,
            quiz: {
              title: "RAG Pipeline Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "What are the five stages of a typical RAG pipeline, in order?",
                  options: [
                    "Generate, retrieve, embed, chunk, ingest",
                    "Ingest, chunk/clean, embed and store, retrieve, construct prompt and generate",
                    "Train, fine-tune, deploy, monitor, retrain",
                    "Embed, ingest, generate, chunk, retrieve",
                  ],
                  correctOption: 1,
                  explanation: "Documents are ingested, split into cleaned chunks, embedded and indexed, then relevant chunks are retrieved per query and used to construct a grounded generation prompt.",
                  topic: "RAG Architecture",
                },
                {
                  prompt: "Why should a RAG system explicitly instruct the LLM to say when it doesn't know an answer?",
                  options: [
                    "It makes responses shorter",
                    "It gives the model permission to decline rather than guess, which is one of the most effective ways to reduce hallucination",
                    "It's required by the vector database",
                    "It has no measurable effect on hallucination",
                  ],
                  correctOption: 1,
                  explanation: "Without this instruction, a model may fall back on possibly-wrong general knowledge instead of admitting the retrieved context doesn't cover the question.",
                  topic: "RAG Architecture",
                },
                {
                  prompt: "Why does an AI course tutor scope retrieval to only the current course's documents?",
                  options: [
                    "It's a performance requirement of vector databases",
                    "It improves relevance and prevents information from other, unrelated courses from leaking into the answer",
                    "Vector search cannot search across multiple documents",
                    "It reduces the size of the LLM",
                  ],
                  correctOption: 1,
                  explanation: "Scoping retrieval reduces irrelevant competing results and keeps context appropriately isolated per course.",
                  topic: "RAG Architecture",
                },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    title: "Cloud Computing & DevOps with AWS",
    description:
      "Learn how production systems are actually deployed and operated: AWS core services, infrastructure as code with Terraform, containerization with Docker, and CI/CD pipelines.",
    category: "Cloud & DevOps",
    level: "ADVANCED",
    thumbnailSeed: "clouddevops",
    modules: [
      {
        title: "Cloud Infrastructure Fundamentals",
        description: "The building blocks every cloud application is made of, and how to manage them as code.",
        lessons: [
          {
            title: "Compute, Storage, and Networking on AWS",
            durationSeconds: 900,
            videoUrl: SAMPLE_VIDEOS[0],
            content: `Cloud compute options exist on a spectrum of control versus operational effort. EC2 (Elastic Compute Cloud) gives full control over virtual machines — you choose the OS, install anything, and are responsible for patching and scaling. AWS Lambda, at the other end, is "serverless": you upload a function, and AWS handles provisioning, scaling to zero when idle, and scaling out automatically under load, but you're constrained to short-lived, stateless execution. Container services like ECS or EKS sit in between, giving control over the application's runtime environment without managing the underlying VMs directly.

S3 (Simple Storage Service) is AWS's object storage: durable, virtually unlimited storage for files (objects), addressed by a bucket name and key, not organized as a traditional filesystem. It's designed for eleven-nines durability, meaning the probability of losing an object in a given year is vanishingly small, achieved by automatically replicating data across multiple physically separate facilities. S3 is commonly used for static assets, backups, and as a data lake, not for data that needs to be queried with SQL or updated in place at the byte level.

A VPC (Virtual Private Cloud) is an isolated network within AWS where resources are launched. Subnets divide a VPC into smaller address ranges, and are marked public (with a route to an internet gateway) or private (no direct internet route). The standard production pattern places a load balancer and possibly bastion hosts in public subnets, while application servers and databases live in private subnets, reachable only from within the VPC — this way, a database is never directly exposed to the public internet, only to the application tier that needs it.

Security groups act as a stateful virtual firewall attached to instances or resources, controlling inbound and outbound traffic by port, protocol, and source. "Stateful" means that if inbound traffic on a given connection is allowed, the corresponding outbound response traffic is automatically allowed too, without needing a separate outbound rule — unlike network ACLs, which are stateless and require explicit rules in both directions.

IAM (Identity and Access Management) controls who — and what services — can do what, following the principle of least privilege: every user, service, and application should be granted only the specific permissions it needs to do its job, and nothing more, since overly broad permissions are one of the most common root causes of security incidents in cloud environments.`,
            quiz: {
              title: "AWS Fundamentals Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "Why should a production database typically live in a private subnet rather than a public one?",
                  options: [
                    "Private subnets are cheaper",
                    "It prevents the database from being directly reachable from the public internet, limiting access to only the application tier",
                    "Databases cannot run in public subnets",
                    "Public subnets don't support databases technically",
                  ],
                  correctOption: 1,
                  explanation: "Keeping the database in a private subnet without a direct internet route drastically reduces its attack surface.",
                  topic: "AWS Networking",
                },
                {
                  prompt: "What does 'stateful' mean for a security group's firewall behavior?",
                  options: [
                    "It remembers previous instances that were launched",
                    "If inbound traffic on a connection is allowed, the corresponding outbound response is automatically allowed without a separate rule",
                    "It stores logs permanently",
                    "It requires a database to function",
                  ],
                  correctOption: 1,
                  explanation: "Stateful tracking means only one direction of a rule needs to be defined explicitly; the return traffic for an allowed connection is auto-permitted.",
                  topic: "AWS Networking",
                },
              ],
            },
          },
          {
            title: "Infrastructure as Code with Terraform",
            durationSeconds: 840,
            videoUrl: SAMPLE_VIDEOS[1],
            content: `Infrastructure as Code (IaC) means defining infrastructure — servers, networks, databases, permissions — in version-controlled configuration files instead of clicking through a cloud console. Terraform is a widely used, cloud-agnostic IaC tool: the same workflow (write config, plan, apply) works across AWS, GCP, Azure, and dozens of other providers, using provider-specific "resource" blocks.

Terraform's core workflow is declarative, not imperative: you describe the desired end state of your infrastructure, and Terraform computes the difference between that desired state and its recorded current state (the "state file"), then figures out what to create, update, or destroy to reconcile them. This is fundamentally different from a shell script that imperatively lists steps to run, because Terraform can safely be re-run at any time — running "terraform apply" again when nothing has changed does nothing, since there's no diff to apply.

"terraform plan" shows exactly what would change without making any changes, which is essential for reviewing infrastructure changes before they happen — much like a diff in a code review, but for infrastructure. Teams typically require a reviewed plan output before allowing "terraform apply" to run in a CI/CD pipeline against production.

The state file is critical and must be handled carefully: it records what Terraform believes exists in the real world, mapped to the resources in configuration. For team use, state is typically stored remotely (e.g., in an S3 bucket with DynamoDB for locking) rather than on a single person's laptop, both so everyone works from the same source of truth and so two people can't apply conflicting changes simultaneously.

Modules let Terraform configuration be organized into reusable components — a "vpc" module, a "database" module — each with defined inputs and outputs, the same way functions organize code. This avoids copy-pasting the same resource definitions across every environment (dev, staging, production) and lets a single, tested module be reused with different input variables per environment.`,
            quiz: {
              title: "Terraform & IaC Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "What does it mean that Terraform's workflow is 'declarative'?",
                  options: [
                    "You write a script of exact steps to execute in order",
                    "You describe the desired end state, and Terraform computes what changes are needed to reach it",
                    "It only works with declarative programming languages",
                    "Terraform cannot make changes automatically",
                  ],
                  correctOption: 1,
                  explanation: "Declarative IaC tools like Terraform diff the desired state against current state and reconcile the difference, rather than executing a fixed imperative sequence.",
                  topic: "Infrastructure as Code",
                },
                {
                  prompt: "Why is Terraform state typically stored remotely (e.g. in S3 with DynamoDB locking) for team use?",
                  options: [
                    "Local state files are not supported by Terraform at all",
                    "So the whole team shares one source of truth and simultaneous applies don't conflict",
                    "Remote state is required for every provider by law",
                    "It makes terraform plan run faster with no other benefit",
                  ],
                  correctOption: 1,
                  explanation: "Shared, locked remote state prevents two people from applying conflicting changes and keeps everyone working from the same recorded infrastructure state.",
                  topic: "Infrastructure as Code",
                },
              ],
            },
          },
        ],
      },
      {
        title: "CI/CD & Containerization",
        description: "Packaging applications consistently and shipping changes safely and automatically.",
        lessons: [
          {
            title: "Docker and Container Orchestration",
            durationSeconds: 900,
            videoUrl: SAMPLE_VIDEOS[2],
            content: `A container packages an application together with its dependencies — libraries, runtime, system tools — into a single image that runs identically regardless of the underlying host, solving the classic "it works on my machine" problem. Unlike a virtual machine, a container does not include a full guest operating system; it shares the host machine's kernel and isolates processes using kernel features like namespaces and cgroups, which is why containers start in milliseconds and use a fraction of the resources a VM would.

A Dockerfile is a text file of instructions used to build an image: FROM sets the base image, COPY adds application code, RUN executes build-time commands (like installing dependencies), and CMD or ENTRYPOINT defines what runs when a container starts from the image. Each instruction creates a cached layer, and Docker reuses unchanged layers on subsequent builds, which is why ordering instructions from least-to-most frequently changing (e.g., installing dependencies before copying application code) significantly speeds up rebuilds.

An image is an immutable, versioned artifact; a container is a running instance of an image. The same image can be run as many independent containers simultaneously, each with its own isolated filesystem layer on top of the shared, read-only image layers underneath — this is also what makes horizontal scaling straightforward, since starting another identical container is just running the same image again.

Multi-stage builds use multiple FROM statements in one Dockerfile so that build-time tools (compilers, dev dependencies) can be used in an early stage but excluded from the final image, keeping production images small and reducing their attack surface by not shipping unnecessary tooling.

Orchestration platforms like Kubernetes manage many containers across many machines: scheduling containers onto available nodes, restarting ones that crash, scaling the number of running replicas up or down based on load, and handling rolling updates so a new version can be deployed without downtime by gradually replacing old containers with new ones while continuously health-checking.`,
            quiz: {
              title: "Docker Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "Why do containers start faster and use fewer resources than virtual machines?",
                  options: [
                    "Containers don't run any code",
                    "Containers share the host's kernel and use namespaces/cgroups for isolation instead of running a full guest OS",
                    "Containers are always smaller in file size than any VM",
                    "There is no meaningful difference",
                  ],
                  correctOption: 1,
                  explanation: "Not needing to boot a full guest operating system is the fundamental reason containers are lighter weight and faster to start than VMs.",
                  topic: "Containerization",
                },
                {
                  prompt: "Why does Dockerfile instruction order (e.g. installing dependencies before copying app code) matter for build speed?",
                  options: [
                    "It doesn't matter; Docker always rebuilds everything",
                    "Docker caches each layer and reuses unchanged layers, so putting frequently-changing steps last maximizes cache hits",
                    "Instructions must be alphabetically ordered",
                    "Only the FROM instruction affects build speed",
                  ],
                  correctOption: 1,
                  explanation: "Layer caching means only layers after the first changed instruction need to be rebuilt, so stable steps should come first.",
                  topic: "Containerization",
                },
                {
                  prompt: "What is the main benefit of a multi-stage Docker build?",
                  options: [
                    "It allows using multiple programming languages in the same file for style reasons only",
                    "Build-time tools and dependencies can be excluded from the final image, keeping it small and reducing attack surface",
                    "It makes the Dockerfile shorter",
                    "It is required to run more than one container",
                  ],
                  correctOption: 1,
                  explanation: "Multi-stage builds let heavy build tooling be used without bloating or exposing it in the final production image.",
                  topic: "Containerization",
                },
              ],
            },
          },
          {
            title: "Building CI/CD Pipelines",
            durationSeconds: 780,
            videoUrl: SAMPLE_VIDEOS[3],
            content: `Continuous Integration (CI) means every code change is automatically built and tested as soon as it's pushed, catching integration problems within minutes rather than discovering them days later when multiple people's changes collide. A typical CI pipeline runs on every pull request: install dependencies, run linters and type checks, run the test suite, and build the application, failing fast and blocking a merge if any step fails.

Continuous Delivery extends this by ensuring the codebase is always in a deployable state after CI passes — every successful build produces a deployable artifact. Continuous Deployment goes one step further and automatically deploys every change that passes the pipeline to production without manual approval, which requires very high confidence in the automated test suite, since there's no human check before users see the change.

A well-designed pipeline runs the fastest, cheapest checks first (formatting, linting) and the slowest, most expensive checks later (integration tests, full builds), so a broken change fails quickly rather than waiting through a long build before an easy-to-catch lint error is reported.

Environment parity — keeping development, staging, and production as similar as possible in configuration, dependencies, and infrastructure — reduces "works in staging, breaks in production" surprises. Docker images are a major tool for achieving this: the exact same built image can be promoted through staging and into production, rather than being rebuilt separately for each environment (which introduces the risk of subtle version drift).

Rollback strategy matters as much as deployment strategy: a pipeline should make it fast and safe to revert to the previous known-good version if a deployment causes problems. Blue-green deployment (running two full production environments and switching traffic between them) and canary deployment (rolling a change out to a small percentage of traffic first, watching metrics, then expanding) are both patterns for reducing the blast radius of a bad deployment, catching problems before they affect all users.`,
            quiz: {
              title: "CI/CD Check",
              passingScore: 70,
              questions: [
                {
                  prompt: "What is the key difference between Continuous Delivery and Continuous Deployment?",
                  options: [
                    "They are the same thing",
                    "Continuous Delivery keeps the codebase always deployable; Continuous Deployment automatically deploys every passing change to production without manual approval",
                    "Continuous Deployment only applies to mobile apps",
                    "Continuous Delivery does not require automated tests",
                  ],
                  correctOption: 1,
                  explanation: "Delivery guarantees deployability at any time; deployment removes the manual gate and ships every passing change automatically.",
                  topic: "CI/CD",
                },
                {
                  prompt: "Why should a CI pipeline run fast checks like linting before slow checks like integration tests?",
                  options: [
                    "It has no effect on total pipeline time",
                    "So a change that fails an easy, cheap check fails fast, rather than waiting through slow, expensive steps first",
                    "Linters cannot run after tests for technical reasons",
                    "It's required by most CI providers",
                  ],
                  correctOption: 1,
                  explanation: "Ordering cheap checks first gives fast feedback on obvious problems, without spending time on expensive steps that a trivial error would invalidate anyway.",
                  topic: "CI/CD",
                },
                {
                  prompt: "What is the purpose of a canary deployment?",
                  options: [
                    "To test infrastructure cost before committing to it",
                    "To roll a change out to a small percentage of traffic first, catching problems before they affect all users",
                    "To permanently run two versions of an application side by side",
                    "To replace the need for automated tests",
                  ],
                  correctOption: 1,
                  explanation: "Canary deployments limit the blast radius of a bad release by exposing it to a small slice of real traffic before a full rollout.",
                  topic: "CI/CD",
                },
              ],
            },
          },
        ],
      },
    ],
  },
];
