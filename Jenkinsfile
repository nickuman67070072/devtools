pipeline {
  agent {
    docker {
      image 'tuchsanai/devtools:2569_1'
      args "--entrypoint='' -u 1000:1000 --group-add 996 -e GIT_CONFIG_COUNT=2 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/workspace -e GIT_CONFIG_KEY_1=safe.directory -e GIT_CONFIG_VALUE_1=/workspace/.git -v /workspace:/workspace:ro -v /var/run/docker.sock:/var/run/docker.sock -v pawmap-playwright-cache:/ms-playwright --add-host=host.docker.internal:host-gateway"
      reuseNode true
    }
  }
  options { disableConcurrentBuilds(); buildDiscarder(logRotator(numToKeepStr: '20')) }
  parameters { string(name: 'BRANCH', defaultValue: 'main', description: 'Local branch') }
  environment {
    BETTER_AUTH_URL = 'http://127.0.0.1:3000'
    APP_ORIGIN = 'http://127.0.0.1:3000'
    S3_ENDPOINT = 'http://host.docker.internal:59000'
    S3_BUCKET = 'pawmap-media'
    S3_REGION = 'ap-southeast-1'
    SMTP_HOST = 'host.docker.internal'
    SMTP_PORT = '58025'
    SMTP_SECURE = 'false'
    MAIL_FROM = 'PawMap CI <noreply@pawmap.invalid>'
    NOMINATIM_CONTACT_EMAIL = 'ci-contact@pawmap.invalid'
    PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3000'
    PLAYWRIGHT_BROWSERS_PATH = '/ms-playwright'
    PAWMAP_E2E_OBJECT_STORAGE = 'memory'
    CI = 'true'
    CI_COMPOSE_PROJECT = "pawmap-ci-${BUILD_NUMBER}"
  }
  stages {
    stage('Prepare ephemeral CI configuration') {
      steps {
        script {
          env.CI_DB_USER = 'pawmap'
          env.CI_DB_PASSWORD = sh(script: 'openssl rand -hex 24', returnStdout: true).trim()
          env.S3_ACCESS_KEY = 'ci' + sh(script: 'openssl rand -hex 8', returnStdout: true).trim()
          env.S3_SECRET_KEY = sh(script: 'openssl rand -hex 32', returnStdout: true).trim()
          env.BETTER_AUTH_SECRET = sh(script: 'openssl rand -hex 32', returnStdout: true).trim()
          env.SEED_ADMIN_EMAIL = 'ci-admin@pawmap.invalid'
          env.SEED_ADMIN_PASSWORD = sh(script: 'openssl rand -base64 36', returnStdout: true).trim()
          env.SEED_USER_EMAIL = 'ci-user@pawmap.invalid'
          env.SEED_USER_PASSWORD = sh(script: 'openssl rand -base64 36', returnStdout: true).trim()
          env.DATABASE_URL = "postgresql://${env.CI_DB_USER}:${env.CI_DB_PASSWORD}@host.docker.internal:55432/pawmap_test?schema=public"
        }
      }
    }
    stage('Local checkout and prohibition gate') {
      steps {
        checkout([$class: 'GitSCM', branches: [[name: "*/${params.BRANCH}"]], extensions: [[$class: 'CleanBeforeCheckout']], userRemoteConfigs: [[url: 'file:///workspace']]])
        sh 'node scripts/verify-no-github.mjs'
        sh 'node scripts/verify-source-allowlist.mjs'
        sh 'node scripts/verify-migrations.mjs'
        sh 'node scripts/verify-boundaries.mjs'
        sh 'node scripts/verify-interactions.mjs'
      }
    }
    stage('Dependencies') { steps { sh 'npm ci' } }
    stage('Static verification') { parallel {
      stage('Prettier') { steps { sh 'npm run format:check' } }
      stage('ESLint') { steps { sh 'npm run lint' } }
      stage('TypeScript strict') { steps { sh 'npm run typecheck' } }
    } }
    stage('Database migrate and seed') {
      steps {
        sh 'docker compose -p "$CI_COMPOSE_PROJECT" -f infra/ci/compose.yml up -d --wait'
        sh 'npx prisma validate'
        sh 'npx prisma migrate deploy'
        sh 'npm run db:seed'
        sh 'npm run db:seed:test-users'
      }
    }
    stage('Unit and integration tests') { steps { sh 'npm run test:coverage'; sh 'npm run test:integration' } }
    stage('Production build') { steps { sh 'npm run build' } }
    stage('Browser, accessibility, and Lighthouse') {
      steps {
        sh 'docker exec -u 0 -w "$WORKSPACE" "$HOSTNAME" sh -lc "chown 1000:1000 /ms-playwright && npx playwright install-deps chromium"'
        sh 'npx playwright install chromium'
        sh 'JENKINS_NODE_COOKIE=dontKillMe nohup npm run start > .next/server.log 2>&1 & echo $! > .next/server.pid'
        sh 'for i in $(seq 1 40); do curl -fsS http://127.0.0.1:3000/api/health/ready && exit 0; sleep 2; done; exit 1'
        sh 'npm run test:e2e'
        sh 'CHROME_PATH="$(node -e "process.stdout.write(require(\'playwright\').chromium.executablePath())")" npx lhci autorun'
      }
    }
    stage('Dependency and filesystem audit') {
      steps {
        sh 'npm audit --audit-level=high'
        sh 'docker run --rm -v trivy-cache:/root/.cache/trivy -v "$WORKSPACE:/src:ro" aquasec/trivy:0.66.0 fs --scanners vuln,secret,misconfig --skip-dirs /src/.git --db-repository public.ecr.aws/aquasecurity/trivy-db:2 --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed /src'
      }
    }
    stage('Build and scan standalone images') {
      steps {
        script { env.COMMIT_SHA = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim() }
        sh 'docker build --secret id=database_url,env=DATABASE_URL --secret id=better_auth_secret,env=BETTER_AUTH_SECRET --target runtime --label pawmap.project=pawmap-local --label pawmap.commit="$COMMIT_SHA" -t "pawmap:$COMMIT_SHA" .'
        sh 'docker build --target migrator --label pawmap.project=pawmap-local --label pawmap.commit="$COMMIT_SHA" -t "pawmap-migrator:$COMMIT_SHA" .'
        sh 'docker run --rm -v trivy-cache:/root/.cache/trivy -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.66.0 image --scanners vuln --db-repository public.ecr.aws/aquasecurity/trivy-db:2 --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed "pawmap:$COMMIT_SHA"'
      }
    }
    stage('Deploy local staging') {
      when { expression { params.BRANCH == 'main' } }
      steps {
        withCredentials([file(credentialsId: 'pawmap-runtime-env', variable: 'PAWMAP_RUNTIME_ENV_FILE')]) {
          sh 'deploy_status=0; sh infra/scripts/deploy-local.sh "pawmap:$COMMIT_SHA" "pawmap-migrator:$COMMIT_SHA" > deployment.log 2>&1 || deploy_status=$?; cat deployment.log; exit "$deploy_status"'
        }
      }
    }
    stage('Readiness smoke') { when { expression { params.BRANCH == 'main' } }; steps { sh 'curl -fsS http://host.docker.internal:3000/api/health/ready'; sh 'curl -fsS http://host.docker.internal:3000/' } }
    stage('Rollback verification') {
      when { expression { params.BRANCH == 'main' } }
      steps {
        withCredentials([file(credentialsId: 'pawmap-runtime-env', variable: 'PAWMAP_RUNTIME_ENV_FILE')]) {
          sh 'sh infra/scripts/verify-deploy-rollback.sh "pawmap-migrator:$COMMIT_SHA" "$COMMIT_SHA"'
        }
      }
    }
  }
  post {
    always {
      sh 'if [ -f .next/server.pid ]; then kill $(cat .next/server.pid) 2>/dev/null || true; fi'
      sh 'docker compose -p "$CI_COMPOSE_PROJECT" -f infra/ci/compose.yml down -v --remove-orphans || true'
      junit allowEmptyResults: true, testResults: 'test-results/*-junit.xml'
      archiveArtifacts allowEmptyArchive: true, artifacts: 'coverage/**,playwright-report/**,test-results/**,lighthouse-report/**,.next/server.log,deployment.log,infra/deploy-logs/**'
      cleanWs(deleteDirs: true, disableDeferredWipeout: true)
    }
  }
}
