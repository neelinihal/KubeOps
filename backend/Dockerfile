# Build stage
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B
COPY src src
RUN ./mvnw package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Install kubectl
RUN apk add --no-cache curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && mv kubectl /usr/local/bin/ && \
    apk del curl

# Install AWS CLI for EKS auth
RUN apk add --no-cache aws-cli

COPY --from=build /app/target/*.jar app.jar

EXPOSE 9090
ENTRYPOINT ["java", "-jar", "app.jar"]
