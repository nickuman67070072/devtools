FROM jenkins/jenkins:lts-jdk21
USER root
RUN apt-get update && apt-get install -y --no-install-recommends docker.io docker-compose git ca-certificates curl && rm -rf /var/lib/apt/lists/* && usermod -aG docker jenkins
USER jenkins
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
USER root
RUN git config --system --add safe.directory /workspace \
    && git config --system --add safe.directory /workspace/.git
USER jenkins
