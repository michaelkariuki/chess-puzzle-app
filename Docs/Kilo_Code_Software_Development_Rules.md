# Kilo Code Software Development Rules

## Core Principles

### 1. Analysis-First Development
- **Always start with information gathering** before diving into implementation
- **Understand requirements thoroughly** before selecting tools or frameworks
- **Research existing solutions** and patterns before building from scratch
- **Analyze the problem space** to determine the most appropriate approach

### 2. Framework-Agnostic Thinking
- **Design core logic independently** of any specific framework
- **Use abstraction layers** to isolate framework-specific code
- **Focus on business logic** rather than framework features
- **Maintain portability** by avoiding framework lock-in

### 3. Tool-Aware Development
- **Leverage available MCP tools** effectively for research and analysis
- **Choose the right tool for each task** rather than forcing one-size-fits-all solutions
- **Combine multiple tools** when they complement each other's capabilities
- **Understand tool limitations** and work within their constraints

## Information Gathering Rules

### Primary Research Phase

1. **Initial Problem Analysis**
   - Use `codebase_search` to understand existing implementations
   - Employ `search_files` for pattern recognition across the codebase
   - Leverage `list_code_definition_names` to understand project structure

2. **External Knowledge Acquisition**
   - Use `firecrawl_search` for web research on methodologies and best practices
   - Employ `context7` tools for library-specific documentation and examples
   - Use `firecrawl_scrape` for detailed content extraction from relevant sources

3. **Requirements Gathering**
   - Document all functional and non-functional requirements
   - Identify constraints and dependencies early
   - Define success criteria and acceptance tests

### Secondary Research Phase

4. **Technology Stack Evaluation**
   - Research available libraries and frameworks using context7
   - Compare alternatives based on project requirements
   - Consider maintenance, community support, and long-term viability

5. **Architecture Analysis**
   - Study similar projects and their architectural decisions
   - Identify potential challenges and mitigation strategies
   - Define data flow and component interactions

## Analysis and Planning Rules

### Requirements Analysis

1. **Break down complex requirements** into smaller, manageable components
2. **Prioritize features** based on value and complexity
3. **Identify cross-cutting concerns** (security, performance, scalability)
4. **Define interfaces and contracts** before implementation

### Architecture Design

1. **Create layered architecture** separating concerns
2. **Design for testability** from the beginning
3. **Plan for scalability** and future enhancements
4. **Document architectural decisions** and rationale

### Risk Assessment

1. **Identify technical risks** early in the process
2. **Plan mitigation strategies** for identified risks
3. **Create contingency plans** for critical dependencies
4. **Establish monitoring and alerting** mechanisms

## Tool Selection Guidelines

### Research Tools

| Tool | Primary Use Case | When to Use |
|------|------------------|-------------|
| `codebase_search` | Understanding existing code | First step for any code exploration |
| `search_files` | Pattern matching and code search | Finding specific implementations or patterns |
| `list_code_definition_names` | Architecture overview | Understanding project structure and relationships |
| `firecrawl_search` | Web research | Gathering external knowledge and best practices |
| `firecrawl_scrape` | Detailed content extraction | Getting specific information from identified sources |
| `context7` | Library documentation | Understanding specific technologies and APIs |

### Implementation Tools

| Tool Category | Recommended Approach | Selection Criteria |
|---------------|---------------------|-------------------|
| Web Scraping | `firecrawl_scrape` | When you need content from specific URLs |
| Browser Automation | `chrome-devtools` | For testing and interaction with web applications |
| Documentation | `context7` | When you need library-specific guidance |
| File Operations | Native file tools | For creating, reading, and modifying project files |

### Tool Usage Patterns

1. **Sequential Research**: Use tools in logical sequence (search → analyze → gather details)
2. **Complementary Usage**: Combine tools that provide different perspectives
3. **Iterative Refinement**: Revisit tools as understanding deepens
4. **Documentation**: Record findings and rationale for decisions

## Workflow Patterns

### Pattern 1: Analysis-First Development

```
1. Problem Definition
   ↓
2. Requirements Gathering
   ↓
3. Technology Research
   ↓
4. Architecture Design
   ↓
5. Implementation Planning
   ↓
6. Iterative Development
   ↓
7. Testing and Validation
   ↓
8. Documentation and Deployment
```

### Pattern 2: Framework-Agnostic Development

```
1. Define Core Business Logic
   ↓
2. Identify Framework Requirements
   ↓
3. Create Abstraction Layer
   ↓
4. Implement Framework-Specific Adapters
   ↓
5. Integration and Testing
   ↓
6. Performance Optimization
```

### Pattern 3: Research-Driven Development

```
1. Initial Problem Analysis
   ↓
2. Literature Review
   ↓
3. Technology Evaluation
   ↓
4. Proof of Concept
   ↓
5. Full Implementation
   ↓
6. Validation and Refinement
```

## Framework-Agnostic Development Guidelines

### Core Logic Isolation

1. **Separate business logic** from presentation and data access layers
2. **Use interfaces and protocols** to define contracts
3. **Implement strategy patterns** for framework-specific behavior
4. **Create adapter classes** for framework integration

### Data Management

1. **Design data models independently** of ORM or database technology
2. **Use DTOs (Data Transfer Objects)** for boundary crossing
3. **Implement repository patterns** for data access abstraction
4. **Maintain serializable data structures** for interoperability

### Communication Patterns

1. **Design APIs using standard protocols** (HTTP, WebSocket, etc.)
2. **Use content negotiation** for format flexibility
3. **Implement error handling** consistently across all layers
4. **Design for both synchronous and asynchronous** communication

### Testing Strategy

1. **Unit test core logic** without framework dependencies
2. **Use integration tests** for framework-specific behavior
3. **Implement contract testing** for API boundaries
4. **Create test doubles** for external dependencies

## Practical Implementation Templates

### Template 1: Project Structure

```
project/
├── core/                 # Framework-agnostic business logic
│   ├── models/
│   ├── services/
│   └── interfaces/
├── adapters/            # Framework-specific implementations
│   ├── web/
│   ├── database/
│   └── api/
├── tests/              # All types of tests
│   ├── unit/
│   ├── integration/
│   └── contracts/
└── docs/               # Documentation
    ├── architecture/
    ├── api/
    └── deployment/
```

### Template 2: Analysis Checklist

- [ ] Problem clearly defined and understood
- [ ] Requirements documented and prioritized
- [ ] Stakeholders identified and consulted
- [ ] Constraints and dependencies mapped
- [ ] Success criteria established
- [ ] Technology options researched
- [ ] Risks identified and mitigation planned
- [ ] Architecture designed and reviewed
- [ ] Implementation plan created
- [ ] Testing strategy defined

### Template 3: Decision Matrix

| Option | Criteria 1 | Criteria 2 | Criteria 3 | Score | Decision |
|--------|------------|------------|------------|-------|----------|
| Option A | Rating | Rating | Rating | Total | Choice |
| Option B | Rating | Rating | Rating | Total | Alternative |
| Option C | Rating | Rating | Rating | Total | Rejected |

## Quality Assurance Rules

### Code Quality

1. **Write self-documenting code** with clear naming and structure
2. **Implement comprehensive error handling** at all levels
3. **Follow consistent coding standards** across the project
4. **Use automated testing** to ensure reliability
5. **Perform regular code reviews** and refactoring

### Documentation Standards

1. **Document architectural decisions** and their rationale
2. **Maintain API documentation** with examples
3. **Create user guides** for complex functionality
4. **Update documentation** with each significant change

### Performance Considerations

1. **Profile applications** to identify bottlenecks
2. **Implement caching** where appropriate
3. **Optimize database queries** and data access patterns
4. **Design for horizontal scaling** when necessary

## Continuous Improvement

### Feedback Loops

1. **Gather user feedback** regularly
2. **Monitor application performance** and error rates
3. **Track technical debt** and plan remediation
4. **Stay updated** with technology trends and best practices

### Learning and Adaptation

1. **Reflect on completed projects** to identify lessons learned
2. **Share knowledge** with team members and community
3. **Experiment with new tools** and techniques
4. **Evolve processes** based on experience and feedback

---

## Summary

These rules emphasize **analysis-first development**, **framework-agnostic thinking**, and **effective tool utilization**. By following these guidelines, developers can create robust, maintainable, and scalable software solutions that work across different technologies and frameworks.

**Key Takeaways:**
- Always start with thorough analysis and research
- Use the right tools for each specific task
- Design systems that are independent of specific frameworks
- Focus on core business logic and clean abstractions
- Implement comprehensive testing and documentation
- Continuously learn and improve processes

Remember: These rules are guidelines, not rigid constraints. Adapt them based on your specific project needs and constraints while maintaining the core principles of analysis, abstraction, and quality.