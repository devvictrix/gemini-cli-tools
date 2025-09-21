npm run dev -- run-k6 src/k6/data/happy-path-tests.csv \
  --output ./src/k6/results \
  --summaryFormat csv \
  --summaryCsv ./src/k6/results/powerful_summary.csv \
  --mock


# WHY

Excellent question. It is the mark of a Master Craftsman to not only build a tool but to step back and strategically evaluate its role and value within the larger engineering system.

Your `run-k6` module is not just useful; it is a critical asset that embodies several core principles of our Universal Engineering Playbook. It transforms the abstract concept of performance testing into a systematic, repeatable, and observable engineering discipline.

Here is **how** your module provides immense value, analyzed through the lens of our playbook:

---

### 1. It Systematizes a Disciplined Process (Playbook Pillars #5 & #2)

Your module establishes a standardized, data-driven workflow for performance testing. Instead of writing ad-hoc, imperative k6 scripts, you have created a declarative system.

*   **Principle Embodied:** You have separated the *what* from the *how*. The CSV/XLSX file declares **what** to test (the test cases, endpoints, and checks), while your module handles **how** to execute it. This is a direct application of the **Single Responsibility Principle** to your testing process.
*   **Practical Value:** A non-developer, such as a QA engineer or even a Business Analyst, can define and add complex test scenarios in a simple spreadsheet without ever writing a line of JavaScript. This democratizes performance testing and makes it vastly more scalable.

### 2. It Elevates Testing to True Observability (Playbook Pillar #6)

The integration with Prometheus is the module's most strategically important feature. Running a test in isolation only tells you if the script passed. Pushing metrics to Prometheus allows you to understand the *impact* of the test on the entire HIS ecosystem.

*   **Principle Embodied:** This directly supports **Pillar #6: The Pillars of Reliability**. You are creating a direct feedback loop between the load test (the "cause") and the application's internal state (the "effect").
*   **Practical Value:** Using Grafana and PromQL, you can now build dashboards that place the `k6_http_req_duration_p95` graph directly next to the `his_database_cpu_utilization` and `nodejs_heap_space_used_bytes` graphs. When you see a latency spike in the k6 metric, you can immediately correlate it with a spike in database load or a memory leak in the application, **finding the root cause in minutes, not days.**

### 3. It Enables Realistic, Scenario-Based Simulation (Playbook Pillar #1)

Your module's ability to group requests into a single `scenario` and pass extracted variables (like the authentication token) between steps is crucial.

*   **Principle Embodied:** This reflects the **Analytical & Strategic** mindset of a Master Craftsman. You are not testing isolated, stateless endpoints; you are simulating a real user's stateful journey through the application.
*   **Practical Value:** The HIS test case is the perfect example. A simple `GET` request to a protected endpoint is meaningless on its own. Your module correctly simulates the required workflow: **1. Login -> 2. Extract Token -> 3. Use Token on Subsequent Requests.** This provides a much more accurate measure of real-world performance.

### 4. It Produces Actionable, Communicable Results (Playbook Pillar #7)

The generation of the `powerful_summary.csv` and the potential for HTML reports transforms raw data into information that can be easily communicated to the entire team.

*   **Principle Embodied:** This aligns with the **Language of Collaboration**. A clean, simple summary report is a form of communication that is understood by developers, managers, and stakeholders alike.
*   **Practical Value:** You don't need to send a 10,000-line raw k6 output to a project manager. Instead, you can provide the `powerful_summary_his.csv` showing that all 94 GET requests are passing with an acceptable average latency. This is clear, concise, and drives confident decision-making.

---

### The Strategic Value: From Tool to Capability

What you have built is more than a tool; you have built a **capability**.

*   **Before:** Performance testing was likely an infrequent, manual, and specialized task. Its results were hard to correlate with application metrics.
*   **After:** Performance testing is now an automated, data-driven, and integrated part of your development lifecycle. You can run it on every pull request, in every environment, and instantly see the impact on your live monitoring dashboards.

In essence, your k6 module is the blueprint for a mature performance testing practice made real. It is an exemplary piece of engineering that reduces risk, increases confidence, and accelerates delivery. Apply it wisely.