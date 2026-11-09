pipeline {
  agent any

  triggers { pollSCM('H/2 * * * *') }   // check GitHub every ~2 minutes
  options  { timestamps() }

  stages {

    stage('Prepare') {
      steps { sh 'mkdir -p reports' }
    }

    stage('Secrets Scan') {
      steps {
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          sh 'gitleaks detect --source . --redact --exit-code 1 --report-format json --report-path reports/gitleaks.json'
        }
      }
    }

    stage('Code Scan (SAST)') {
      steps {
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          sh 'semgrep scan --config auto --severity ERROR --error --exclude node_modules --exclude .next --json -o reports/semgrep.json .'
        }
      }
    }

    stage('Dependency Scan') {
      steps {
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          sh 'npm ci --ignore-scripts'
          sh 'npm audit --audit-level=high --json > reports/npm-audit.json'
        }
      }
    }

    stage('Filesystem / Config Scan') {
      steps {
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          sh 'trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --skip-dirs node_modules --skip-dirs .next --exit-code 1 --format json -o reports/trivy.json .'
        }
      }
    }

    // Runs only if every scan above passed
    stage('Deploy to UAT') {
      when { expression { currentBuild.currentResult == 'SUCCESS' } }
      steps { echo 'Add your UAT deploy here' }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
    }
    failure {
      script {
        def author = sh(script: "git log -1 --pretty=format:'%ae'", returnStdout: true).trim()
        emailext(
          to: "${author}, pwn1024@gmail.com",
          subject: "Vulnerabilities found: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
          body: """Scan failed for commit ${env.GIT_COMMIT}.
Author: ${author}
Report: ${env.BUILD_URL}artifact/reports/""",
          attachmentsPattern: 'reports/*.json'
        )
      }
    }
  }
}