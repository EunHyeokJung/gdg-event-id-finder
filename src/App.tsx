import { useState } from 'react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [debugLogs, setDebugLogs] = useState<string[]>([])

  const addDebugLog = (message: string) => {
    console.log(message)
    setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const findEventId = async () => {
    if (!url.trim()) {
      setError('Please enter a URL.')
      return
    }

    // URL validation
    try {
      new URL(url)
    } catch {
      setError('Please enter a valid URL.')
      return
    }

    setLoading(true)
    setError('')
    setResult('')
    setCopied(false)
    setDebugLogs([])

    addDebugLog(`Search started: ${url}`)

    // Try multiple proxy services
    const proxyServices = [
      'https://api.allorigins.win/get?url=',
      'https://cors-anywhere.herokuapp.com/',
      'https://thingproxy.freeboard.io/fetch/'
    ]

    for (let i = 0; i < proxyServices.length; i++) {
      const proxyUrl = proxyServices[i]
      addDebugLog(`Trying proxy service ${i + 1}: ${proxyUrl}`)

      try {
        const targetUrl = proxyUrl.includes('allorigins') 
          ? encodeURIComponent(url)
          : url

        const fullUrl = `${proxyUrl}${targetUrl}`
        addDebugLog(`Request URL: ${fullUrl}`)

        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        })

        addDebugLog(`Response status: ${response.status} ${response.statusText}`)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        let htmlContent: string

        // Handle response differently based on proxy service
        if (proxyUrl.includes('allorigins')) {
          const data = await response.json()
          addDebugLog('JSON parsing successful (allorigins)')
          htmlContent = data.contents
        } else if (proxyUrl.includes('thingproxy')) {
          // thingproxy returns HTML directly
          htmlContent = await response.text()
          addDebugLog('HTML fetch successful (thingproxy)')
        } else {
          // cors-anywhere etc return HTML directly
          htmlContent = await response.text()
          addDebugLog('HTML fetch successful')
        }

        addDebugLog(`HTML length: ${htmlContent.length} characters`)

        // Search for __NEXT_DATA__ script tag
        addDebugLog('Searching for __NEXT_DATA__ script tag...')
        const scriptRegex = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s
        const match = htmlContent.match(scriptRegex)

        if (!match) {
          addDebugLog('__NEXT_DATA__ script tag not found')
          
          // Try alternative patterns
          const alternativePatterns = [
            /<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s,
            /<script[^>]*type="application\/json"[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s
          ]
          
          for (const pattern of alternativePatterns) {
            const altMatch = htmlContent.match(pattern)
            if (altMatch) {
              addDebugLog('Script found with alternative pattern')
              break
            }
          }
          
          if (i === proxyServices.length - 1) {
            throw new Error('__NEXT_DATA__ script not found.')
          } else {
            addDebugLog('Trying next proxy service...')
            continue
          }
        }

        addDebugLog('__NEXT_DATA__ script found, attempting JSON parsing...')
        
        // Parse JSON
        const jsonData = JSON.parse(match[1])
        addDebugLog('JSON parsing successful')
        
        // Extract value from Props.pageProps.customBlockData.eventData.static_url path
        addDebugLog('Exploring static_url path...')
        const staticUrl = jsonData?.props?.pageProps?.customBlockData?.eventData?.static_url

        if (staticUrl) {
          addDebugLog(`static_url found: ${staticUrl}`)
          setResult(staticUrl)
          setLoading(false)
          return
        } else {
          addDebugLog('static_url not found')
          addDebugLog(`Full structure: ${JSON.stringify(jsonData, null, 2).substring(0, 500)}...`)
          
          if (i === proxyServices.length - 1) {
            throw new Error('static_url not found in the specified path.')
          }
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        addDebugLog(`Proxy service ${i + 1} failed: ${errorMessage}`)
        
        if (i === proxyServices.length - 1) {
          setError(`All proxy services failed. Last error: ${errorMessage}`)
        }
      }
    }

    setLoading(false)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const clearDebugLogs = () => {
    setDebugLogs([])
  }

  return (
    <div className="app-container">
      <h1>GDG Event ID Finder</h1>
      
      <div className="input-section">
        <div className="input-group">
          <label htmlFor="url-input">Website URL:</label>
          <input
            id="url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="url-input"
            onKeyPress={(e) => e.key === 'Enter' && findEventId()}
          />
        </div>
        
        <button 
          onClick={findEventId}
          disabled={loading}
          className="find-button"
        >
          {loading ? 'Searching...' : 'Find ID'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {debugLogs.length > 0 && (
        <div className="debug-section">
          <div className="debug-header">
            <h3>Debug Logs</h3>
            <button onClick={clearDebugLogs} className="clear-button">
              Clear Logs
            </button>
          </div>
          <div className="debug-logs">
            {debugLogs.map((log, index) => (
              <div key={index} className="debug-log-item">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="result-section">
          <div className="result-header">
            <h2>Result:</h2>
            <button 
              onClick={copyToClipboard}
              className={`copy-button ${copied ? 'copied' : ''}`}
            >
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
          
          <div className="result-content">
            <div className="result-item">
              <label className="result-label">Event ID:</label>
              <div className="result-value-inline">
                {(() => {
                  const match = result.match(/\/e\/([^\/]+)\/?$/)
                  return match ? match[1] : 'Extraction failed'
                })()}
              </div>
            </div>
            
            <div className="result-item">
              <label className="result-label">static_url:</label>
              <div className="result-value-inline">
                {result}
              </div>
            </div>
            
            <div className="result-actions">
              <button 
                onClick={() => {
                  const match = result.match(/\/e\/([^\/]+)\/?$/)
                  if (match) {
                    const eventId = match[1]
                    const surveyUrl = `https://gdg.community.dev/e/${eventId}/survey/post_event_team`
                    window.open(surveyUrl, '_blank')
                  }
                }}
                className="survey-button"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>
          Made by{' '}
          <a 
            href="https://linkedin.com/in/eunhyeok-jung" 
            target="_blank" 
            rel="noopener noreferrer"
            className="footer-link"
          >
            EunHyeok Jung
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App
