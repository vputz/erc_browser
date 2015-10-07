(ns parse-erc.core
  (require [clojure.java.io :as io]
           [clojure.data.csv :as csv]
           [clojure.edn :as edn]
           [clojure.data.json :as json]
           [clojure.string :as str]
           [clojure.pprint :refer :all]
           [clojure.zip :as zip]
           [semantic-csv.core :as sc :refer :all]))


(defn as-rows [file]
  (process 
   (csv/read-csv file :separator \;)))

(defn domains [] ["PE1" "PE2" "PE3" "PE4" "PE5" "PE6" "PE7" "PE8" "PE9" "PE10"
                  "LS1" "LS2" "LS3" "LS4" "LS5" "LS6" "LS7" "LS8" "LS9"
                  "SH1" "SH2" "SH3" "SH4" "SH5" "SH6"])

(defn grant-types [] ["AG" ; Advanced grant
                      "ADG"
                      "CG" ; Consolidator grant
                      "CoG" ; ?
                      "SG" ; Starting Grant
                      "STG" ;
                      "StG"
                      "PoC" ; 
                      "SyG"])

(defn likely-match [topic possibilities]
  ; Searches through topic for any of the substrings in domains and 
  ; returns that or "Undefined"
  (let [matches (filter #((complement =) nil %) 
                        (map #(re-find (re-pattern %) topic) possibilities))]
    (cond 
      (> (count matches) 0) (first matches)
      true "Undefined")))

(defn grant-category [topic]
  (let [remap {"AG" "Advanced Grant"
               "ADG" "Advanced Grant"
               "CG" "Consolidator Grant"
               "CoG" "Consolidator Grant"
               "SG" "Starting Grant"
               "STG" "Starting Grant"
               "StG" "Starting Grant"
               "PoC" "Proof of Concept"
               "SyG" "Synergy Grant"}]
    (get remap (likely-match topic (grant-types)) "Undefined")))

(defn pi-name [row-entry]
  (let [candidates (filter #(= "coordinator" (% :role)) 
                           (get row-entry :participants))]
    (cond 
      (> (count candidates) 0) ((first candidates) :name)
      true "Undefined")))

(defn hi-name [row-entry]
  (let [candidates (filter #(= "hostInstitution" (% :role))
                               (row-entry :participants))]
    (cond
      (> (count candidates) 0) ((first candidates) :name)
      true "Undefined")))

(defn parse-int [s]
  (try (Integer/parseInt (re-find #"\A-?\d+" s))
       (catch NumberFormatException e -1)))

(defn call-year [call]
  (parse-int (re-find #"\d\d\d\d" call)))

(defn print-participants [participants]
  (letfn [(name [p] (str (p :name)))
          (role [p] (str "(" (p :role) ")"))
          (website [p]
            (cond
              (> (count (p :organizationUrl)) 0) (p :organizationUrl)
              true ""))
          (contact [p] 
            (cond
              (> (count (p :contactFirstNames)) 0) (str " (contact: " (p :contactFirstNames) " " (p :contactLastNames))
              true ""))]
    (apply str (interpose "\n" (map #(apply str (interpose " " (list (name %) (role %) (website %) (contact %)))) participants)))))

(defn browser-entry [row-entry]
  (assoc {} 
         :project (row-entry :title)
         :acronym (row-entry :acronym)
         :pi (pi-name row-entry)
         :hi (hi-name row-entry)
         :country (row-entry :coordinatorCountry)
         :call_details (row-entry :call)
         :call_year (call-year (row-entry :call))
         :call_domain (likely-match (row-entry :topics) (domains))
         :summary (row-entry :objective)
         :erc_funding (parse-int (row-entry :ecMaxContribution))
         :startDate (row-entry :startDate)
         :endDate (row-entry :endDate)
         :duration (str (row-entry :startDate) "-" (row-entry :endDate))
         :category (grant-category (row-entry :topics))
         :print_participants (print-participants (row-entry :participants))
         :participants (row-entry :participants)))

(defn begins-with [prefix s]
  (let [plen (count prefix)]
    (try 
      (cond
        (> plen (count s)) false
        (= (subs s 0 (count prefix)) prefix) true))))


(defn fieldset [field filename]
  (with-open [file (io/reader filename)]
    (set (doall (map #(get % (keyword field)) 
                     (as-rows file))))))

(defn erc-entries [proj-filename org-filename]
  (with-open [proj-file (io/reader proj-filename)
              org-file (io/reader org-filename)]
    (let [proj-rows (as-rows proj-file)
          orgs (group-by :projectReference (doall (as-rows org-file)))];-rows (partition-by #(get % :projectReference) (as-rows org-file))]
      (do
        (let [erc-projects (filter #(begins-with "ERC" (% :topics)) proj-rows)]
          (do 
            (let [projects (map #(let [participants (get orgs (:reference %))]
                                   (do (if (= 0 (count participants))
                                         (println "No participants for ref " (:reference %) ", acronym " (:acronym %)))
                                       (assoc % :participants participants))) erc-projects)] ;(:participants(first %) :participants (second %)) (map vector proj-rows org-rows))]
              (doall projects))))))))


(defn corpus-entry 
  "Make a corpus entry from a cordis entry"
  [m]
  (hash-map :abstract (clojure.string/replace (:objective m) (str \newline) " ")
            :acronym (:acronym m)
            :ec-contribution (parse-int (:ecMaxContribution m))
            :reference (:reference m)))

(defn abstract-corpus [proj-reader]
  (let [proj-rows (as-rows proj-reader)]
    (filter #((complement clojure.string/blank?) (:abstract %))
            (map corpus-entry proj-rows))))

(defn take-csvrows [n filename]
  (with-open [in-file (io/reader filename)]
    (let [csv-rows (as-rows in-file)]
      (doall (take n csv-rows)))))

(defn write-corpus [proj-filename out-filename]
  (with-open [in-file (io/reader proj-filename)
              out-file (io/writer out-filename)]
    (.write out-file (apply str (interpose (str \newline) (map :abstract (abstract-corpus in-file)))))))

(defn write-corpus-info [proj-filename out-filename]
  (with-open [in-file (io/reader proj-filename)
              out-file (io/writer out-filename)]
    (json/write (abstract-corpus in-file) out-file)))

(defn make-projects-json []
  (let [fp7-entries (erc-entries "cordis-fp7projects.csv" "cordis-fp7organizations.csv") 
        h2020-entries (erc-entries "cordis-h2020projects.csv" "cordis-h2020organizations.csv")]
    (do
      (with-open [out-file (io/writer "projects.json")]
        (json/write (map browser-entry (concat fp7-entries h2020-entries)) out-file)))))


     
